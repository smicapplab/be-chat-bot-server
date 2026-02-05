import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/utils/jwt-auth.guard';
import { CreatUserDto } from './dto/add-user.dto';
import { SearchUserDto } from './dto/search-user';
import { UserDto } from './dto/user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('user')
export class UserController {
    constructor(
        private readonly userService: UserService
    ) { }

    @UseGuards(JwtAuthGuard)
    @Get()
    async getUsers(@Query() dto: SearchUserDto): Promise<{ success: boolean, users?: UserDto[]; total?: number; page?: number, message?: string }> {
        try {
            const { users, total, page } = await this.userService.getUsers(dto);
            return { success: true, users, total, page };
        } catch (error) {
            return {
                success: false,
                message: 'Could not fetch projects: ' + error.message,
            };
        }
    }

    @UseGuards(JwtAuthGuard)
    @Post()
    async addUserByEmail(
        @Body() dto: CreatUserDto
    ): Promise<{ success?: boolean; data?: { id?: number }; message?: string }> {
        try {
            await this.userService.addUserByEmail(dto);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: 'Could not fetch projects: ' + error.message,
            };
        }
    }

    @UseGuards(JwtAuthGuard)
    @Delete("/deactivate/:userId")
    async deactivateUser(
        @Param('userId', ParseIntPipe) userId: number,
        @Request() req,
    ): Promise<{ success?: boolean; data?: { id?: number }; message?: string }> {
        try {
            await this.userService.deactivateUser(userId, req.user);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: 'Could not fetch projects: ' + error.message,
            };
        }
    }

    @UseGuards(JwtAuthGuard)
    @Patch('update')
    async updateUser(
        @Body() dto: UserDto,
        @Request() req: any
    ): Promise<any> {
        try {
            await this.userService.updateUser(dto, req.user);
            return {
                success: true,
            }
        } catch (error) {
            return {
                success: false,
                message: error.message
            }
        }
    }

    @UseGuards(JwtAuthGuard)
    @Post('change-password')
    async changePassword(@Body() dto: ChangePasswordDto, @Request() req: any): Promise<{ success: boolean, message: string }> {
        try {
            await this.userService.changePassword(dto, req.user);
            return {
                success: true,
                message: 'Password changed successfully'
            }
        } catch (error) {
            return {
                success: false,
                message: error.message
            }
        }
    }
    
}
