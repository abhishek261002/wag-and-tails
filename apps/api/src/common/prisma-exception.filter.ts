import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Turns database errors caused by the request into proper client errors instead of a 500 with no explanation:
 *  - P2023: a value the database cannot read (e.g. an id in the URL that is not a UUID) -> 400
 *  - P2025: the record to update or delete does not exist -> 404
 * Anything else is left as the server error it is, and logged.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('PrismaExceptionFilter');

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception.code === 'P2023') {
      status = HttpStatus.BAD_REQUEST; message = 'One of the values you sent is not valid'; error = 'Bad Request';
    } else if (exception.code === 'P2025') {
      status = HttpStatus.NOT_FOUND; message = 'Not found'; error = 'Not Found';
    } else {
      this.logger.error(`${exception.code}: ${exception.message.split('\n').pop()}`);
    }
    reply.status(status).send({ statusCode: status, message, error });
  }
}
