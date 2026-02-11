#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = process.cwd();
const TARGET_DIRS = ['frontend/src', 'backend/src', 'functions/src'];
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'lib',
  'coverage',
  '.next',
  '.cache',
]);

const BLOCKED_ENDPOINT_PATTERNS = [
  'v2.order.get_order_detail',
  'v2.returns.get_return_list',
  'v2.returns.get_return_detail',
  'v2.order.get_buyer_invoice_info',
  '/api/v2/order/get_order_detail',
  '/api/v2/returns/get_return_list',
  '/api/v2/returns/get_return_detail',
  '/api/v2/order/get_buyer_invoice_info',
];

function walk(dirPath, fileList) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        walk(fullPath, fileList);
      }
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      fileList.push(fullPath);
    }
  }
}

function findLineNumbers(content, pattern) {
  const lines = content.split(/\r?\n/);
  const found = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes(pattern)) {
      found.push(i + 1);
    }
  }
  return found;
}

function main() {
  const files = [];
  for (const relativeDir of TARGET_DIRS) {
    walk(path.join(REPO_ROOT, relativeDir), files);
  }

  const violations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of BLOCKED_ENDPOINT_PATTERNS) {
      if (!content.includes(pattern)) continue;
      const lines = findLineNumbers(content, pattern);
      for (const line of lines) {
        violations.push({
          file: path.relative(REPO_ROOT, file).replace(/\\/g, '/'),
          pattern,
          line,
        });
      }
    }
  }

  if (violations.length > 0) {
    console.error('[shopee-endpoint-policy] blocked endpoint usage detected:');
    for (const violation of violations) {
      console.error(`- ${violation.file}:${violation.line} -> "${violation.pattern}"`);
    }
    process.exit(1);
  }

  console.log('[shopee-endpoint-policy] OK - no blocked Shopee endpoints found in source code');
}

main();
