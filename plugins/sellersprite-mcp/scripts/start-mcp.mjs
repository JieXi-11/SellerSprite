#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(pluginRoot);
await import(pathToFileURL(resolve(pluginRoot, 'src/server.mjs')).href);
