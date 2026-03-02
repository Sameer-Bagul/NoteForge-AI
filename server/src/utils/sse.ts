import { Response } from 'express';

export interface SSEEvent {
    event: string;
    data: any;
}

export class SSEStream {
    constructor(private res: Response) {
        // Set standard SSE headers
        this.res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable buffering for Nginx
        });

        // Send initial keep-alive
        this.send(': keep-alive\n\n');
    }

    sendEvent(event: string, data: any) {
        this.send(`event: ${event}\n`);
        this.send(`data: ${JSON.stringify(data)}\n\n`);
    }

    sendDelta(text: string) {
        this.sendEvent('delta', { text });
    }

    sendProgress(status: string, progress: number, details?: string) {
        this.sendEvent('progress', { status, progress, details });
    }

    sendComplete(data: any) {
        this.sendEvent('complete', data);
        this.end();
    }

    sendError(error: string) {
        this.sendEvent('error', { error });
        this.end();
    }

    private send(chunk: string) {
        this.res.write(chunk);
    }

    private end() {
        this.res.end();
    }
}
