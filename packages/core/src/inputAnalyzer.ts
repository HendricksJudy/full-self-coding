import { PipelineMode, InputType } from './hciConfig';

import * as fs from 'fs';
import * as path from 'path';

/**
 * Detection result from input analysis.
 */
export interface InputDetectionResult {
  inputType: InputType;
  mode: PipelineMode;
  meta: Record<string, any>;
}

const DATA_EXTENSIONS = new Set(['csv', 'tsv', 'json', 'jsonl', 'xlsx', 'parquet']);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'text']);

/**
 * Analyzes user input to determine what was provided and which
 * pipeline mode to use. Replaces the original FSC analyzer.ts.
 *
 * Detection logic:
 *   - Data files (csv, json, xlsx...) → Mode B (real data)
 *   - Directory of data files         → Mode B
 *   - Text file                       → Classify as topic or RQ → Mode A
 */
export class InputAnalyzer {
  /**
   * Examine input path and determine input type and pipeline mode.
   */
  static async detect(inputPath: string): Promise<InputDetectionResult> {
    const stat = await fs.promises.stat(inputPath);

    // Case 1: Directory → scan for data files
    if (stat.isDirectory()) {
      return InputAnalyzer.detectDirectory(inputPath);
    }

    const ext = path.extname(inputPath).slice(1).toLowerCase();

    // Case 2: Data file → Mode B
    if (DATA_EXTENSIONS.has(ext)) {
      return InputAnalyzer.detectDataFile(inputPath, ext);
    }

    // Case 3: Text file → classify content
    if (TEXT_EXTENSIONS.has(ext)) {
      return InputAnalyzer.detectTextFile(inputPath);
    }

    // Case 4: Unknown → attempt text read
    try {
      return await InputAnalyzer.detectTextFile(inputPath);
    } catch {
      throw new Error(
        `Cannot determine input type for: ${inputPath}. ` +
        `Supported: data files (${[...DATA_EXTENSIONS].join(', ')}), ` +
        `text files (${[...TEXT_EXTENSIONS].join(', ')}), or directories.`
      );
    }
  }

  /**
   * Detect a directory of input files.
   * Finds the main data file (largest) and any supplementary files.
   */
  private static async detectDirectory(dirPath: string): Promise<InputDetectionResult> {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const files = entries.filter((e: any) => e.isFile());

    const dataFiles: { name: string; size: number; ext: string }[] = [];
    const textFiles: string[] = [];

    for (const file of files) {
      const ext = path.extname(file.name).slice(1).toLowerCase();
      const filePath = path.join(dirPath, file.name);
      const fileStat = await fs.promises.stat(filePath);

      if (DATA_EXTENSIONS.has(ext)) {
        dataFiles.push({ name: file.name, size: fileStat.size, ext });
      } else if (TEXT_EXTENSIONS.has(ext)) {
        textFiles.push(file.name);
      }
    }

    // If data files found → Mode B
    if (dataFiles.length > 0) {
      // Main file = largest data file
      dataFiles.sort((a, b) => b.size - a.size);
      const mainFile = dataFiles[0];

      return {
        inputType: InputType.DATASET,
        mode: PipelineMode.REAL_DATA,
        meta: {
          mainDataFile: mainFile.name,
          mainDataFormat: mainFile.ext,
          supplementaryFiles: dataFiles.slice(1).map((f) => f.name),
          textFiles,
          totalDataFiles: dataFiles.length,
        },
      };
    }

    // Only text files → treat as topic/RQ
    if (textFiles.length > 0) {
      const mainTextPath = path.join(dirPath, textFiles[0]);
      return InputAnalyzer.detectTextFile(mainTextPath);
    }

    throw new Error(`No supported files found in directory: ${dirPath}`);
  }

  /**
   * Detect a single data file.
   */
  private static async detectDataFile(
    filePath: string,
    ext: string,
  ): Promise<InputDetectionResult> {
    const stat = await fs.promises.stat(filePath);

    const meta: Record<string, any> = {
      fileName: path.basename(filePath),
      fileFormat: ext,
      fileSize: stat.size,
    };

    // Quick row/column count for CSV/TSV
    if (ext === 'csv' || ext === 'tsv') {
      try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const lines = content.split('\n').filter((l: string) => l.trim().length > 0);
        const delimiter = ext === 'tsv' ? '\t' : ',';
        const headerCols = lines[0]?.split(delimiter).length || 0;
        meta.rowCount = lines.length - 1; // exclude header
        meta.columnCount = headerCols;
        meta.columns = lines[0]?.split(delimiter).map((c: string) => c.trim().replace(/^"(.*)"$/, '$1'));
      } catch {
        // Best-effort; profiler will do thorough analysis later
      }
    }

    // Quick peek for JSON
    if (ext === 'json') {
      try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          meta.rowCount = parsed.length;
          meta.columnCount = parsed[0] ? Object.keys(parsed[0]).length : 0;
          meta.columns = parsed[0] ? Object.keys(parsed[0]) : [];
        }
      } catch {
        // Best-effort
      }
    }

    return {
      inputType: InputType.DATASET,
      mode: PipelineMode.REAL_DATA,
      meta,
    };
  }

  /**
   * Detect a text file. Classify as topic or research question
   * based on heuristics.
   */
  private static async detectTextFile(filePath: string): Promise<InputDetectionResult> {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const trimmed = content.trim();
    const classification = InputAnalyzer.classifyText(trimmed);

    return {
      inputType: classification.type,
      mode: PipelineMode.SIMULATED,
      meta: {
        content: trimmed,
        ...classification,
      },
    };
  }

  /**
   * Classify text content as a topic or a research question.
   *
   * Heuristics:
   * - Contains "?" → likely a research question
   * - Contains RQ markers ("RQ1", "H1", "hypothesis") → research question
   * - Starts with "How", "What", "Does", "Is", "Can", "Do" → research question
   * - Short (< 20 words), no question markers → topic
   * - Long with structured content → research question
   */
  static classifyText(text: string): { type: InputType; confidence: number; reasoning: string } {
    const lower = text.toLowerCase();
    const wordCount = text.split(/\s+/).length;

    // Strong RQ signals
    if (text.includes('?')) {
      return {
        type: InputType.RESEARCH_QUESTION,
        confidence: 0.9,
        reasoning: 'Contains question mark — likely a research question.',
      };
    }

    if (/\b(RQ\d|H\d|hypothesis|research question)/i.test(text)) {
      return {
        type: InputType.RESEARCH_QUESTION,
        confidence: 0.95,
        reasoning: 'Contains explicit RQ/hypothesis markers.',
      };
    }

    if (/^(how|what|does|is|can|do|why|whether|which)\b/i.test(text.trim())) {
      return {
        type: InputType.RESEARCH_QUESTION,
        confidence: 0.8,
        reasoning: 'Starts with a question word.',
      };
    }

    // Long structured text → likely a detailed RQ or proposal
    if (wordCount > 50) {
      return {
        type: InputType.RESEARCH_QUESTION,
        confidence: 0.6,
        reasoning: 'Long text — treating as detailed research question/proposal.',
      };
    }

    // Short text without question markers → topic
    return {
      type: InputType.TOPIC,
      confidence: 0.7,
      reasoning: 'Short text without question markers — treating as topic.',
    };
  }
}
