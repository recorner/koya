import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom throttler guard that:
 * 1. Extracts real client IP from X-Forwarded-For (ALB)
 * 2. Allows skipping health/internal routes
 */
@Injectable()
export class KoyaThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(KoyaThrottlerGuard.name);

  /**
   * Extract the real client IP from X-Forwarded-For header.
   * ALB appends the client IP as the leftmost entry.
   */
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = req['headers'] as Record<string, string | string[]> | undefined;
    const xff = headers?.['x-forwarded-for'];
    if (typeof xff === 'string') {
      // Take the leftmost (client) IP
      const clientIp = xff.split(',')[0]?.trim();
      if (clientIp) return clientIp;
    }
    return (req as Record<string, string>)['ip'] ?? 'unknown';
  }

  /**
   * Skip throttling for health and internal routes.
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ url?: string }>();
    const url = req.url ?? '';

    // Skip health endpoints and internal routes
    if (
      url.includes('/health') ||
      url.startsWith('/internal/')
    ) {
      return true;
    }

    return false;
  }
}
