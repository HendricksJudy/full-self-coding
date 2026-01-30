import * as fs from 'fs';
import * as path from 'path';

/**
 * Lightweight data loader for the HCI research toolchain.
 *
 * This module ONLY handles pre-processing:
 *   - Read files, detect format
 *   - Extract basic structural metadata (shape, column names, sample rows)
 *   - Package into a DataSnapshot for AI agents
 *
 * ALL intelligent analysis (type inference, study design reconstruction,
 * statistical testing, visualization, interpretation) is done by AI agents
 * in Docker containers, just like FSC lets AI agents write code.
 *
 * The DataProfiler produces a "snapshot" that gets passed to AI agents
 * via the prompt. The agents do the real data science.
 */
export class DataProfiler {
  /**
   * Load a data file and produce a structural snapshot.
   * This is a thin pre-processor — no inference, no statistics.
   */
  static async snapshot(filePath: string): Promise<DataSnapshot> {
    const stat = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const fileName = path.basename(filePath);

    const content = await fs.promises.readFile(filePath, 'utf8');
    const { headers, sampleRows, totalRows } = DataProfiler.parseAndSample(content, ext);

    return {
      source: {
        fileName,
        fileFormat: ext,
        fileSize: stat.size,
      },
      shape: {
        rowCount: totalRows,
        columnCount: headers.length,
      },
      columns: headers,
      sampleRows,
      rawContentPreview: content.slice(0, 5000),
    };
  }

  /**
   * Load a directory of data files.
   * Returns the main file (largest) and supplementary file list.
   */
  static async snapshotDirectory(dirPath: string): Promise<{
    mainDataFile: string;
    supplementaryFiles: string[];
    snapshot: DataSnapshot;
  }> {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const dataExts = new Set(['csv', 'tsv', 'json', 'jsonl', 'xlsx', 'parquet']);

    const dataFiles: { name: string; size: number }[] = [];
    const supplementary: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).slice(1).toLowerCase();
      const fp = path.join(dirPath, entry.name);
      const s = await fs.promises.stat(fp);

      if (dataExts.has(ext)) {
        dataFiles.push({ name: entry.name, size: s.size });
      } else {
        supplementary.push(entry.name);
      }
    }

    dataFiles.sort((a, b) => b.size - a.size);
    const mainFile = dataFiles[0]?.name;
    if (!mainFile) throw new Error(`No data files found in ${dirPath}`);

    const snapshot = await DataProfiler.snapshot(path.join(dirPath, mainFile));

    return {
      mainDataFile: mainFile,
      supplementaryFiles: [
        ...dataFiles.slice(1).map((f) => f.name),
        ...supplementary,
      ],
      snapshot,
    };
  }

  // --- Parsing (minimal, just enough for AI context) ---

  private static parseAndSample(
    content: string,
    format: string,
  ): { headers: string[]; sampleRows: Record<string, string>[]; totalRows: number } {
    switch (format) {
      case 'csv': return DataProfiler.sampleCSV(content, ',');
      case 'tsv': return DataProfiler.sampleCSV(content, '\t');
      case 'json': return DataProfiler.sampleJSON(content);
      case 'jsonl': return DataProfiler.sampleJSONL(content);
      default: return DataProfiler.sampleCSV(content, ',');
    }
  }

  private static sampleCSV(
    content: string,
    delimiter: string,
  ): { headers: string[]; sampleRows: Record<string, string>[]; totalRows: number } {
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], sampleRows: [], totalRows: 0 };

    const headers = DataProfiler.splitCSVLine(lines[0], delimiter);
    const totalRows = lines.length - 1;

    // Sample: first 20 rows + last 5 rows (for AI to see distribution)
    const sampleIndices = [
      ...Array.from({ length: Math.min(20, totalRows) }, (_, i) => i + 1),
      ...Array.from({ length: Math.min(5, totalRows) }, (_, i) => lines.length - 1 - i).filter((i) => i > 20),
    ];

    const sampleRows: Record<string, string>[] = [];
    for (const idx of sampleIndices) {
      if (idx >= lines.length) continue;
      const values = DataProfiler.splitCSVLine(lines[idx], delimiter);
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || '';
      }
      sampleRows.push(row);
    }

    return { headers, sampleRows, totalRows };
  }

  private static splitCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  private static sampleJSON(
    content: string,
  ): { headers: string[]; sampleRows: Record<string, string>[]; totalRows: number } {
    const parsed = JSON.parse(content);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    if (arr.length === 0) return { headers: [], sampleRows: [], totalRows: 0 };

    const headers = Object.keys(arr[0]);
    const totalRows = arr.length;
    const sample = [...arr.slice(0, 20), ...arr.slice(-5)].slice(0, 25);

    const sampleRows = sample.map((obj) => {
      const row: Record<string, string> = {};
      for (const key of headers) {
        row[key] = String(obj[key] ?? '');
      }
      return row;
    });

    return { headers, sampleRows, totalRows };
  }

  private static sampleJSONL(
    content: string,
  ): { headers: string[]; sampleRows: Record<string, string>[]; totalRows: number } {
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], sampleRows: [], totalRows: 0 };

    const firstObj = JSON.parse(lines[0]);
    const headers = Object.keys(firstObj);
    const totalRows = lines.length;
    const sampleLines = [...lines.slice(0, 20), ...lines.slice(-5)].slice(0, 25);

    const sampleRows = sampleLines.map((l) => {
      const obj = JSON.parse(l);
      const row: Record<string, string> = {};
      for (const key of headers) {
        row[key] = String(obj[key] ?? '');
      }
      return row;
    });

    return { headers, sampleRows, totalRows };
  }
}

/**
 * A lightweight data snapshot — just structure and samples.
 * All intelligence (type inference, pattern detection, statistics)
 * is delegated to AI agents.
 */
export interface DataSnapshot {
  source: {
    fileName: string;
    fileFormat: string;
    fileSize: number;
  };
  shape: {
    rowCount: number;
    columnCount: number;
  };
  columns: string[];
  /** First ~20 rows + last ~5 rows as key-value objects */
  sampleRows: Record<string, string>[];
  /** First 5000 chars of the raw file (for AI to see formatting) */
  rawContentPreview: string;
}
