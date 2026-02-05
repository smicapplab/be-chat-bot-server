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
        try {
            const result = await this.chatService.search(dto);
            console.log(result)
            return { ...result, message: "" }
        } catch (error) {
            console.error(error)
            return { success: false, result: "", message: "Something went wrong.  Please try again." }
        }
    }

    @UseGuards(JwtAuthGuard)
    @Post("search-session")
    async searchSessionByKeyword(
        @Body() dto: { keyword: string }
    ) {
        try {
            const sessions = await this.chatService.searchSessionByKeyword(dto.keyword);
            return { success: true, sessions }
        } catch (error) {
            console.error(error)
            return { success: false, result: "", message: "Something went wrong.  Please try again." }
        }
    }

    @UseGuards(JwtAuthGuard)
    @Post("title")
    async getSessionByTitle(
        @Body() dto: { title: string }
    ) {
        try {
            const session = await this.chatService.getSessionByTitle(dto.title);
            return { success: true, session }
        } catch (error) {
            console.error(error)
            return { success: false, message: "Something went wrong.  Please try again." }
        }
    }

    @UseGuards(JwtAuthGuard)
    @Post("id")
    async getSessionById(
        @Body() dto: { id: number }
    ) {
        try {
            const session = await this.chatService.getSessionById(dto.id);
            return { success: true, session }
        } catch (error) {
            console.error(error)
            return { success: false, message: "Something went wrong.  Please try again." }
        }
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
