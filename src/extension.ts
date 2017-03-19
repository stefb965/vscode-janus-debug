'use strict';

import * as fs from 'fs';
import { isAbsolute, join } from 'path';
import * as vscode from 'vscode';

const initialConfigurations = [
    {
        name: 'Launch Script on Server',
        request: 'launch',
        type: 'janus',
        script: '',
        username: '',
        password: '${command.extension.vscode-janus-debug.askForPassword}',
        principal: '',
        host: 'localhost',
        applicationPort: 10000,
        debuggerPort: 8089,
        stopOnEntry: false,
        log: {
            fileName: '${workspaceRoot}/vscode-janus-debug-launch.log',
            logLevel: {
                default: 'Debug',
            },
        },
    },
    {
        name: 'Attach to Server',
        request: 'attach',
        type: 'janus',
        host: 'localhost',
        debuggerPort: 8089,
        log: {
            fileName: '${workspaceRoot}/vscode-janus-debug-attach.log',
            logLevel: {
                default: 'Debug',
            },
        },
    },
];

export function activate(context: vscode.ExtensionContext): void {

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.vscode-janus-debug.askForPassword', () => {
            return vscode.window.showInputBox({
                prompt: 'Please enter the password',
                password: true,
                ignoreFocusOut: true,
            });
        }));

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.vscode-janus-debug.provideInitialConfigurations', () => {

            let entryPoint: string | undefined = undefined;

            // Get 'main' property from package.json iff there is a package.json. This is probably the primary entry
            // point for the program and we use it to set the "script" property in our initial configurations.

            const packageJsonPath = join(vscode.workspace.rootPath, 'package.json');

            try {
                const jsonContent = fs.readFileSync(packageJsonPath, 'utf8');
                const jsonObject = JSON.parse(jsonContent);
                if (jsonObject.main) {
                    entryPoint = jsonObject.main;
                } else if (jsonObject.scripts && typeof jsonObject.scripts.start === 'string') {
                    entryPoint = jsonObject.scripts.start.split(' ').pop();
                }

                if (entryPoint) {
                    entryPoint = isAbsolute(entryPoint) ? entryPoint : join('${workspaceRoot}', entryPoint);
                    initialConfigurations.forEach((config: any) => {
                        if (config.hasOwnProperty('script')) {
                            config.script = entryPoint;
                        }
                    });
                }
            } catch (err) {
                // Silently ignore every error. We need to provide an initial configuration whether we have found the
                // main entry point or not.
            }

            const configurations = JSON.stringify(initialConfigurations, null, '\t')
                .split('\n').map(line => '\t' + line).join('\n').trim();
            return [
                '{',
                '\t// Use IntelliSense to learn about possible configuration attributes.',
                '\t// Hover to view descriptions of existing attributes.',
                '\t// For more information, visit',
                '\t// https://github.com/otris/vscode-janus-debug/wiki/Launching-the-Debugger',
                '\t"version": "0.2.0",',
                '\t"configurations": ' + configurations,
                '}',
            ].join('\n');

        }));
}

export function deactivate(): undefined {
    return;
}
