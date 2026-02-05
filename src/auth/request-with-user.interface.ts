
import { Request } from 'express';

//Steve: Chill no type yet temporary
export interface RequestWithUser extends Request {
    user: any;
}