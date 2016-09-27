'use strict';

import * as assert from 'assert';
import { Response, Command, ErrorCode } from './protocol';
import { Logger } from './log';
import { DebugConnection } from './connection';

export type ContextId = number;

let contextLog = Logger.create('Context');

export class Context {
    public isStopped(): boolean {
        return this.stopped ? this.stopped : false;
    }

    constructor(private debugConnection: DebugConnection,
        public readonly id: ContextId,
        public readonly name: string,
        private readonly stopped?: boolean) { }

    public pause(): Promise<void> {
        contextLog.debug(`request pause for context ${this.id}`);

        let cmd = new Command('pause', this.id);
        return this.debugConnection.sendRequest(cmd, (response: Response) => {

            return new Promise<void>((resolve, reject) => {
                if (response.type === 'error') {
                    if (response.content.code === ErrorCode.IS_PAUSED) {
                        contextLog.warn(`context ${this.id} is already paused`);
                        resolve();
                        return;
                    }

                    reject(new Error(response.content.message));
                    return;
                }

                resolve();
            });
        });
    }

    public continue(): Promise<void> {
        contextLog.debug(`request continue for context ${this.id}`);

        let cmd = new Command('continue', this.id);
        return this.debugConnection.sendRequest(cmd);
    }

    public handleResponse(response: Response): Promise<void> {
        contextLog.debug(`handleResponse ${response} for context ${this.id}`);
        return Promise.resolve();
    }
}

let coordinatorLog = Logger.create('ContextCoordinator');

/** Coordinates requests and responses for all available contexts.
 *
 * Resposibilities:
 * - Keep track of all available contexts of the target.
 * - Dispatch incoming responses to their corresponding context.
 */
export class ContextCoordinator {
    private contextById: Map<ContextId, Context> = new Map();

    constructor(private debugConnection: DebugConnection) { }

    public getContext(id: ContextId): Context /* | undefined */ {
        return this.contextById.get(id);
    }

    public handleResponse(response: Response): Promise<void> {
        coordinatorLog.debug(`handleResponse ${JSON.stringify(response)}`);

        return new Promise<void>((resolve, reject) => {

            if (response.contextId === undefined) {

                // Not meant for a particular context

                if (response.type === 'info' && response.subtype === 'contexts_list') {
                    coordinatorLog.debug('updating list of available contexts');
                    assert.ok(response.content.hasOwnProperty('contexts'));

                    // Add new contexts
                    response.content.contexts.forEach(element => {
                        if (!this.contextById.has(element.contextId)) {
                            coordinatorLog.debug(`creating new context with id: ${element.contextId}`);
                            let newContext: Context = new Context(this.debugConnection, element.contextId, element.contextName,
                                element.paused);
                            this.contextById.set(element.contextId, newContext);

                            // Notify the frontend that we have a new context in the target
                            this.debugConnection.emit('newContext', newContext.id, newContext.name, newContext.isStopped());
                        }
                    });

                    // Purge the ones that no longer exist
                    let dead: ContextId[] = [];
                    this.contextById.forEach(context => {
                        if (!response.content.contexts.find(element => element.contextId === context.id)) {
                            coordinatorLog.debug(`context ${context.id} no longer exists`);
                            dead.push(context.id);
                        }
                    });
                    dead.forEach(id => this.contextById.delete(id));
                }
            } else {

                // Dispatch to the corresponding context

                let context: Context = this.contextById.get(response.contextId);
                assert.ok(context !== undefined, "response for unknown context");
                context.handleResponse(response);
            }
        });
    }
}