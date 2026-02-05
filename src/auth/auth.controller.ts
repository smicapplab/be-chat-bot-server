import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRequestDto } from './dto/user-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService
    ) { }

    @Post('/auth-social')
    async authenticateSocial(
        @Body() dto: UserRequestDto
    ): Promise<LoginResponseDto> {
        try {
            const response = await this.authService.authenticateSocial(dto)
            return response;
        } catch (error) {
            return {
                success: false,
                message: error.message || "Authentication Error"
            }
        }
    }

    @Post('/login-with-email')
    async loginWithEmail(
        @Body() dto: { email: string; password: string; }
    ): Promise<LoginResponseDto> {
        try {
            const response = await this.authService.loginWithEmail(dto);
            return response;
        } catch (error) {
            return {
                success: false,
                message: error.message || "Authentication Error"
            }
        }
    }

    @Post("/forgot-password")
    async forgotPassword(
        @Body() dto: { email: string }
    ): Promise<{ success?: boolean; message?: string }> {
        return this.authService.forgotPassword(dto);
    }

    @Post("/change-password")
    async changePassword(
        @Body() dto: { resetCode: string, newPassword: string }
    ): Promise<{ success?: boolean; message?: string }> {
        return this.authService.changePassword(dto);
    }
}
