const bcrypt = require("bcryptjs");

export class PasswordUtil {
    
    static async hashPassword(password: string, saltRounds: number = 10): Promise<string> {
        try {
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            return hashedPassword;
        } catch (error) {
            console.error("Error hashing password:", error);
            throw new Error("Failed to hash password");
        }
    }

    static async comparePasswords(password: string, hashPassword: string): Promise<Boolean> {
        return await bcrypt.compare(password, hashPassword);
    }
}