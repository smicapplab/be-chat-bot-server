import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from 'src/database/database.service';
import { UserRequestDto } from './dto/user-request.dto';
import { CaseUtil } from 'src/utils/case-util';
import { PasswordUtil } from 'src/utils/password-util';
import { EmailService } from 'src/utils/email-util';
import { randomBytes } from 'crypto';

/**
 * Service handling authentication, login, and password management.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) { }

  /**
   * Authenticates a user via social login providers.
   * @param dto Data containing user email.
   * @returns Success status and a JWT token.
   */
  async authenticateSocial(dto: UserRequestDto): Promise<{ success: boolean; jwt: string }> {
    const { email } = dto;
    const knex = this.databaseService.getKnex();

    try {
      const user = await knex('app_user as u')
        .leftJoin('role as r', 'u.role_id', 'r.id')
        .select(
          'u.id',
          'u.email',
          'u.first_name as firstName',
          'u.last_name as lastName',
          'u.provider',
          'u.is_active as isActive',
          'r.role_name as roleName'
        )
        .where('u.email', email.toLowerCase())
        .first();

      if (!user) {
        throw new UnauthorizedException('User not found or has not registered.');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account deactivated. For assistance or reactivation, please contact support.');
      }

      // Convert Postgres array syntax to JS array
      if (typeof user.provider === 'string') {
        user.provider = user.provider
          .replace(/^{|}$/g, '')
          .split(',')
          .map((p: string) => p.trim());
      }

      const camelCaseUser = CaseUtil.keysToCamelCase(user);
      
      // Minimize JWT payload to non-sensitive identifiers
      const payload = {
        id: camelCaseUser.id,
        email: camelCaseUser.email,
        firstName: camelCaseUser.firstName,
        lastName: camelCaseUser.lastName,
        roleName: camelCaseUser.roleName,
      };

      const jwt = this.jwtService.sign(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      return { success: true, jwt };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      console.error('[AuthService] Unexpected error during authentication:', error);
      throw new InternalServerErrorException('An unexpected error occurred while processing your request.');
    }
  }

  /**
   * Logins a user using email and password.
   * @param dto Login credentials.
   * @returns Success status and a JWT token.
   */
  async loginWithEmail(dto: { email: string; password: string; }): Promise<{ success: boolean; jwt: string }> {
    const knex = this.databaseService.getKnex();
    try {
      const user = await knex('app_user as u')
        .leftJoin('role as r', 'u.role_id', 'r.id')
        .select(
          'u.id',
          'u.password',
          'u.email',
          'u.first_name as firstName',
          'u.last_name as lastName',
          'u.provider',
          'u.is_active as isActive',
          'r.role_name as roleName'
        )
        .where('u.email', dto.email.toLowerCase())
        .first();

      if (!user) {
        throw new UnauthorizedException('The username or password you entered is incorrect. Please try again.');
      }

      const isPasswordValid = await PasswordUtil.comparePasswords(dto.password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('The username or password you entered is incorrect. Please try again.');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account deactivated. For assistance or reactivation, please contact support.');
      }

      // Convert Postgres array syntax to JS array
      if (typeof user.provider === 'string') {
        user.provider = user.provider
          .replace(/^{|}$/g, '')
          .split(',')
          .map((p: string) => p.trim());
      }

      const camelCaseUser = CaseUtil.keysToCamelCase(user);

      // Minimize JWT payload to non-sensitive identifiers
      const payload = {
        id: camelCaseUser.id,
        email: camelCaseUser.email,
        firstName: camelCaseUser.firstName,
        lastName: camelCaseUser.lastName,
        roleName: camelCaseUser.roleName,
      };

      // Generate JWT
      const jwt = this.jwtService.sign(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      return { success: true, jwt };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      console.error(error);
      throw new UnauthorizedException('The username or password you entered is incorrect. Please try again.');
    }
  }

  /**
   * Changes the user's password using a reset code.
   * @param dto Reset code and new password.
   * @returns Success status and a message.
   */
  async changePassword(dto: { resetCode: string, newPassword: string }): Promise<{ success: boolean; message?: string }> {
    const knex = this.databaseService.getKnex();
    try {
      const resetRecord = await knex('password_reset')
        .where('reset_code', dto.resetCode)
        .andWhere('expire_at', '>', new Date())
        .first();

      if (!resetRecord) {
        return { success: false, message: "The reset link is invalid or has expired." };
      }

      const hashedPassword = await PasswordUtil.hashPassword(dto.newPassword);
      await knex('app_user')
        .where('id', resetRecord.user_id)
        .update({
          password: hashedPassword,
          updated_at: knex.fn.now(),
        });

      await knex('password_reset')
        .where('id', resetRecord.id)
        .del();

      return { success: true, message: "Password successfully updated." };
    } catch (error) {
      console.error("Error updating password:", error);
      return { success: false, message: "Something went wrong. Please try again later." };
    }
  }

  /**
   * Initiates the forgot password process by generating a reset code and sending an email.
   * @param dto User's email address.
   * @returns Success status or an error message.
   */
  async forgotPassword(dto: { email: string }): Promise<{ success: boolean; message?: string }> {
    const knex = this.databaseService.getKnex();
    try {
      // Find the user by email
      const user = await knex('app_user').where('email', dto.email).first();

      if (!user) {
        return { success: false, message: 'We couldn’t find an account associated with that email address. Please check for typos or try a different email.' };
      }

      // Generate reset code and expiration
      const resetCode = randomBytes(5).toString('hex');
      const expireAt = new Date(Date.now() + (24 * 60 * 60 * 1000));
      const chatAdminUrl = this.configService.get<string>('CHAT_ADMIN_URL');
      const resetUrl = `${chatAdminUrl}/change-password/${resetCode}`;

      // Upsert password_reset entry
      const existing = await knex('password_reset').where('user_id', user.id).first();

      if (existing) {
        await knex('password_reset')
          .where('id', existing.id)
          .update({ reset_code: resetCode, expire_at: expireAt });
      } else {
        await knex('password_reset').insert({
          user_id: user.id,
          reset_code: resetCode,
          expire_at: expireAt,
        });
      }

      // Send email
      const htmlBody = `
          <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; padding: 20px;">
            <h2 style="color: #1a73e8;">Password Reset Request</h2>
            <p>Hello,</p>
            <p>We received a request to reset your password for your Bot account.</p>
            <p>Please click the button below to set a new password:</p>
            <p style="margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p>If the button doesn't work, copy and paste the following URL into your browser:</p>
            <p style="word-break: break-all;"><a href="${resetUrl}">${resetUrl}</a></p>
            <hr style="margin: 40px 0;" />
            <p style="font-size: 12px; color: #999;">
              If you did not request a password reset, you can safely ignore this email. No changes will be made to your account.
            </p>
            <p style="font-size: 12px; color: #999;">— Bot Admin Team</p>
          </div>
        `;

      await this.emailService.sendEmail({
        to: [dto.email],
        htmlBody,
        subject: "Reset Your Bot Chat Password",
      });

      return { success: true };
    } catch (error) {
      console.error("forgotPassword error:", error);
      return { success: false, message: "Oops! Something went wrong. Please try again." };
    }
  }
}