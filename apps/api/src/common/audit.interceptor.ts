import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { sub: string; role: string } | undefined;
    const method = request.method as string;
    const url = request.url as string;

    return next.handle().pipe(
      tap(() => {
        // Audit log for mutating operations on admin/staff routes
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && user) {
          // Emit to audit log service (injected in specific modules)
          // This interceptor is a lightweight marker — full audit happens in services
        }
      })
    );
  }
}
