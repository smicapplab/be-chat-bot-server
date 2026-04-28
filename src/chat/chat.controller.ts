import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatDto } from './dto/chat-payload.dto';
import { JwtAuthGuard } from 'src/utils/jwt-auth.guard';

@Controller('chat')
export class ChatController {
    constructor(
        private readonly chatService: ChatService
    ) { }

    @Post()
    async search(
        @Body() dto: ChatDto
    ) {
        const result = await this.chatService.search(dto);
        console.log(result)
        return { ...result, message: "" }
    }

    @UseGuards(JwtAuthGuard)
    @Post("search-session")
    async searchSessionByKeyword(
        @Body() dto: { keyword: string }
    ) {
        const sessions = await this.chatService.searchSessionByKeyword(dto.keyword);
        return { success: true, sessions }
    }

    @UseGuards(JwtAuthGuard)
    @Post("title")
    async getSessionByTitle(
        @Body() dto: { title: string }
    ) {
        const session = await this.chatService.getSessionByTitle(dto.title);
        return { success: true, session }
    }

    @UseGuards(JwtAuthGuard)
    @Post("id")
    async getSessionById(
        @Body() dto: { id: number }
    ) {
        const session = await this.chatService.getSessionById(dto.id);
        return { success: true, session }
    }

    @UseGuards(JwtAuthGuard)
    @Get("sessions")
    async getRecentSessionsByUser(
        @Request() req,
    ) {
        const sessions = await this.chatService.getRecentSessionsByUser(req.user.id);
        return {
            success: true,
            sessions
        }
    }

    @UseGuards(JwtAuthGuard)
    @Post("history/sessions")
    async getAllSessions(
        @Body() dto: { keyword: string, page: number },
    ) {
        const sessions = await this.chatService.getAllSessions(dto.keyword, dto.page);
        return {
            success: true,
            sessions
        }
    }
}
