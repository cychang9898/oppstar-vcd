#!/usr/bin/env node
'use strict';

const process = require('process');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const directories = [];
const pushd = (dir) => {
  directories.push(process.cwd());
  process.chdir(dir);
};
const popd = () => {
  let dir = directories.pop();
  if (dir) {
    process.chdir(dir);
  }
};

// https://stackoverflow.com/a/31104898/19336104
const termSync = (commandLine) => {
  cp.execSync(commandLine, {stdio: 'inherit'});
};

const mkdirSync = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
};

const cpSync = (src, dst) => {
  try {
    if (fs.statSync(dst).isDirectory()) {
      dst = path.join(dst, path.basename(src));
    }
  } catch (err) {
    // ignore error, we just want to test if destination a directory
  }
  fs.cpSync(src, dst, {force: true});
};

const where = (command) => {
  try {
    if (process.platform === 'win32') {
      return cp.execSync(`where ${command}`, {stdio: 'pipe'});
    }
    return cp.execSync(`command -v ${command}`, {stdio: 'pipe'});
  } catch (err) {
    // ignore error
  }
  return undefined;
};

const cmdExist = (command) => {
  return !!where(command);
};

const getPackageMan = () => {
  if (fs.existsSync('yarn.lock') || (!fs.existsSync('package-lock.json') && cmdExist('yarn'))) {
    return 'yarn';
  }
  return 'npm';
};

pushd(__dirname);

const pacMan = getPackageMan();

termSync(`${pacMan} install`);

// Re-copy binding.gyp, this needs to be copied and deleted so that we don't auto-build
cpSync(path.join('bin', 'binding.gyp'), 'binding.gyp');
termSync(`node ${path.join('bin', 'build.js')}`);
fs.rmSync('binding.gyp');

// Get user EMSDK or set a clone path
const emsdk = process.env.EMSDK || path.join(os.homedir(), 'emsdk');

// Clone emcc
if (!fs.existsSync(emsdk)) {
  termSync(`git clone https://github.com/emscripten-core/emsdk.git ${emsdk}`);
}
const emsdkv = '3.1.26';    // Latest version that works on Windows

// Run emcc
fs.rmSync('out', { recursive: true, force: true });
if (process.platform === 'linux') {
  // Default shell is 'sh', 'source' only works in 'bash'
  termSync(`bash -c "${emsdk}/emsdk install ${emsdkv} && ${emsdk}/emsdk activate ${emsdkv} && EMSDK_QUIET=1 && source ${emsdk}/emsdk_env.sh && make"`);
} else if (process.platform === 'win32') {
  termSync(`call ${emsdk}\\emsdk.bat install ${emsdkv} && call ${emsdk}\\emsdk.bat activate ${emsdkv} && set EMSDK_QUIET=1 && call ${emsdk}\\emsdk_env.bat && make"`);
} else {
  console.log(`Use original wasm, emcc for '${process.platform}' is not ready!`);
}

popd();