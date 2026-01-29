import type { DataProfile, ColumnProfile, KnownQuestionnaireMatch } from './types';
import { KNOWN_QUESTIONNAIRES } from './knownQuestionnaires';

import * as fs from 'fs';
import * as path from 'path';

/**
 * Profiles a dataset without any contextual information.
 * Pure computation — no AI, no Docker. Runs locally.
 */
export class DataProfiler {
  /**
   * Profile a data file.
   */
  static async profile(filePath: string): Promise<DataProfile> {
    const stat = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase() as DataProfile['source']['fileFormat'];
    const fileName = path.basename(filePath);

    // Parse the data
    const { headers, rows } = await DataProfiler.parseFile(filePath, ext);

    // Profile each column
    const columns = DataProfiler.profileColumns(headers, rows);

    // Detect patterns
    const patterns = DataProfiler.detectPatterns(columns, rows);

    // Assess quality
    const quality = DataProfiler.assessQuality(columns, rows);

    return {
      source: {
        fileName,
        fileFormat: ext,
        fileSize: stat.size,
        encoding: 'utf-8',
      },
      shape: {
        rowCount: rows.length,
        columnCount: headers.length,
      },
      columns,
      patterns,
      quality,
    };
  }

  /**
   * Profile a directory of data files.
   */
  static async profileDirectory(dirPath: string): Promise<{
    mainDataFile: string;
    supplementaryFiles: string[];
    profile: DataProfile;
  }> {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const dataExts = new Set(['csv', 'tsv', 'json', 'jsonl', 'xlsx']);

    const dataFiles: { name: string; size: number }[] = [];
    const supplementary: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).slice(1).toLowerCase();
      const filePath = path.join(dirPath, entry.name);
      const fileStat = await fs.promises.stat(filePath);

      if (dataExts.has(ext)) {
        dataFiles.push({ name: entry.name, size: fileStat.size });
      } else {
        supplementary.push(entry.name);
      }
    }

    // Main file = largest
    dataFiles.sort((a, b) => b.size - a.size);
    const mainFile = dataFiles[0]?.name;
    if (!mainFile) throw new Error(`No data files found in ${dirPath}`);

    const profile = await DataProfiler.profile(path.join(dirPath, mainFile));

    return {
      mainDataFile: mainFile,
      supplementaryFiles: [
        ...dataFiles.slice(1).map((f) => f.name),
        ...supplementary,
      ],
      profile,
    };
  }

  // --- Parsing ---

  private static async parseFile(
    filePath: string,
    format: string,
  ): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
    const content = await fs.promises.readFile(filePath, 'utf8');

    switch (format) {
      case 'csv': return DataProfiler.parseCSV(content, ',');
      case 'tsv': return DataProfiler.parseCSV(content, '\t');
      case 'json': return DataProfiler.parseJSON(content);
      case 'jsonl': return DataProfiler.parseJSONL(content);
      default:
        // Attempt CSV as fallback
        return DataProfiler.parseCSV(content, ',');
    }
  }

  private static parseCSV(
    content: string,
    delimiter: string,
  ): { headers: string[]; rows: Record<string, string>[] } {
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = DataProfiler.splitCSVLine(lines[0], delimiter);
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = DataProfiler.splitCSVLine(lines[i], delimiter);
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || '';
      }
      rows.push(row);
    }

    return { headers, rows };
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

  private static parseJSON(content: string): { headers: string[]; rows: Record<string, string>[] } {
    const parsed = JSON.parse(content);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    if (arr.length === 0) return { headers: [], rows: [] };

    const headers = Object.keys(arr[0]);
    const rows = arr.map((obj) => {
      const row: Record<string, string> = {};
      for (const key of headers) {
        row[key] = String(obj[key] ?? '');
      }
      return row;
    });

    return { headers, rows };
  }

  private static parseJSONL(content: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const objects = lines.map((l) => JSON.parse(l));
    if (objects.length === 0) return { headers: [], rows: [] };

    const headers = Object.keys(objects[0]);
    const rows = objects.map((obj) => {
      const row: Record<string, string> = {};
      for (const key of headers) {
        row[key] = String(obj[key] ?? '');
      }
      return row;
    });

    return { headers, rows };
  }

  // --- Column profiling ---

  private static profileColumns(headers: string[], rows: Record<string, string>[]): ColumnProfile[] {
    return headers.map((name) => {
      const values = rows.map((r) => r[name]).filter((v) => v !== '' && v !== undefined && v !== null);
      const missingCount = rows.length - values.length;

      const inferredType = DataProfiler.inferColumnType(name, values);
      const inferredRole = DataProfiler.inferColumnRole(name, inferredType, values, rows.length);

      const profile: ColumnProfile = {
        name,
        inferredType,
        originalType: typeof values[0],
        missingCount,
        missingPercentage: rows.length > 0 ? (missingCount / rows.length) * 100 : 0,
        inferredRole,
      };

      if (inferredType === 'numeric' || inferredType === 'ordinal') {
        const nums = values.map(Number).filter((n) => !isNaN(n));
        if (nums.length > 0) {
          profile.numericStats = DataProfiler.computeNumericStats(nums);
        }
      }

      if (inferredType === 'categorical' || inferredType === 'ordinal') {
        profile.categoricalStats = DataProfiler.computeCategoricalStats(values);
      }

      return profile;
    });
  }

  private static inferColumnType(
    name: string,
    values: string[],
  ): ColumnProfile['inferredType'] {
    if (values.length === 0) return 'text';

    const sample = values.slice(0, 100);

    // Check for boolean
    const boolValues = new Set(sample.map((v) => v.toLowerCase()));
    if (boolValues.size <= 2 && [...boolValues].every((v) => ['true', 'false', '0', '1', 'yes', 'no'].includes(v))) {
      return 'boolean';
    }

    // Check if all parseable as numbers
    const allNumeric = sample.every((v) => !isNaN(Number(v)) && v.trim() !== '');
    if (allNumeric) {
      const nums = sample.map(Number);
      const allIntegers = nums.every((n) => Number.isInteger(n));
      const uniqueCount = new Set(nums).size;
      const min = Math.min(...nums);
      const max = Math.max(...nums);

      // Check for Likert-like ordinal scales
      if (allIntegers && uniqueCount <= 10 && min >= 0 && max <= 10) {
        return 'ordinal';
      }

      return 'numeric';
    }

    // Check for timestamps
    const timestampPatterns = [
      /^\d{4}-\d{2}-\d{2}/,
      /^\d{2}\/\d{2}\/\d{4}/,
      /^\d{10,13}$/,
    ];
    if (sample.every((v) => timestampPatterns.some((p) => p.test(v)))) {
      return 'timestamp';
    }

    // Check for ID-like columns
    const uniqueRatio = new Set(values).size / values.length;
    if (uniqueRatio > 0.9 && /id|participant|subject|user|pid/i.test(name)) {
      return 'id';
    }

    // Check for categorical
    const uniqueValues = new Set(values).size;
    if (uniqueValues < 20 && uniqueValues < values.length * 0.2) {
      return 'categorical';
    }

    return 'text';
  }

  private static inferColumnRole(
    name: string,
    type: ColumnProfile['inferredType'],
    values: string[],
    totalRows: number,
  ): ColumnProfile['inferredRole'] {
    const lower = name.toLowerCase();

    // ID columns
    if (/^(id|participant[_\s]?id|subject[_\s]?id|user[_\s]?id|pid|uid)$/i.test(name) || type === 'id') {
      return 'participant_id';
    }

    // Condition/group columns
    if (/^(condition|group|treatment|intervention|interface|method|technique|version|variant)$/i.test(name)) {
      return 'condition';
    }

    // Timestamp columns
    if (type === 'timestamp' || /^(time|date|timestamp|created|trial)$/i.test(name)) {
      return 'timestamp';
    }

    // Numeric columns after condition-like columns → likely DV
    if (type === 'numeric' || type === 'ordinal') {
      // Known DV patterns
      if (/time|duration|latency|accuracy|error|score|rating|count|completion/i.test(lower)) {
        return 'dependent_variable';
      }
      // Questionnaire items are DVs
      if (/^(sus|tlx|ueq|q\d|item|likert)/i.test(lower)) {
        return 'dependent_variable';
      }
      return 'dependent_variable'; // default for numeric
    }

    // Categorical with few levels → likely IV
    if (type === 'categorical') {
      const uniqueCount = new Set(values).size;
      if (uniqueCount <= 5) return 'independent_variable';
      return 'covariate';
    }

    return 'unknown';
  }

  // --- Statistics ---

  private static computeNumericStats(nums: number[]): ColumnProfile['numericStats'] {
    const n = nums.length;
    const sorted = [...nums].sort((a, b) => a - b);

    const mean = nums.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
    const variance = nums.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1);
    const std = Math.sqrt(variance);

    // Skewness (Fisher's)
    const m3 = nums.reduce((sum, x) => sum + ((x - mean) / std) ** 3, 0) / n;
    const skewness = n > 2 ? (n / ((n - 1) * (n - 2))) * nums.reduce((sum, x) => sum + ((x - mean) / std) ** 3, 0) : 0;

    // Kurtosis (excess)
    const m4 = nums.reduce((sum, x) => sum + ((x - mean) / std) ** 4, 0) / n;
    const kurtosis = m4 - 3;

    // Approximate normality test (simplified Shapiro-Wilk approximation)
    // For a proper test, we'd need scipy. This is a rough heuristic.
    const normalityPValue = DataProfiler.approximateNormalityP(sorted, mean, std);

    return {
      mean,
      median,
      std,
      min: sorted[0],
      max: sorted[n - 1],
      skewness: isNaN(skewness) ? 0 : skewness,
      kurtosis: isNaN(kurtosis) ? 0 : kurtosis,
      normalityPValue,
      isNormal: normalityPValue > 0.05,
    };
  }

  /**
   * Approximate normality p-value using D'Agostino-Pearson omnibus test approximation.
   * This is a rough heuristic; the actual analysis phase will use scipy for proper testing.
   */
  private static approximateNormalityP(sorted: number[], mean: number, std: number): number {
    const n = sorted.length;
    if (n < 8) return 0.5; // Too small to test

    // Use skewness and kurtosis as indicators
    const skew = sorted.reduce((sum, x) => sum + ((x - mean) / std) ** 3, 0) / n;
    const kurt = sorted.reduce((sum, x) => sum + ((x - mean) / std) ** 4, 0) / n - 3;

    // Rough chi-square approximation
    const chi2 = (skew ** 2) * (n / 6) + (kurt ** 2) * (n / 24);
    // Approximate p-value (chi-square with df=2)
    const p = Math.exp(-chi2 / 2);
    return Math.min(1, Math.max(0, p));
  }

  private static computeCategoricalStats(values: string[]): ColumnProfile['categoricalStats'] {
    const counts: Record<string, number> = {};
    for (const v of values) {
      counts[v] = (counts[v] || 0) + 1;
    }

    const uniqueValues = Object.keys(counts);
    const maxCount = Math.max(...Object.values(counts));
    const minCount = Math.min(...Object.values(counts));
    const mode = uniqueValues.find((k) => counts[k] === maxCount) || '';

    return {
      uniqueValues,
      valueCounts: counts,
      mode,
      isBalanced: uniqueValues.length > 1 && (maxCount / minCount) < 1.5,
    };
  }

  // --- Pattern detection ---

  private static detectPatterns(columns: ColumnProfile[], rows: Record<string, string>[]): DataProfile['patterns'] {
    const participantIdCol = columns.find((c) => c.inferredRole === 'participant_id');
    const conditionCols = columns.filter((c) => c.inferredRole === 'condition');
    const timestampCols = columns.filter((c) => c.inferredType === 'timestamp');

    // Check for repeated measures
    let isRepeatedMeasures = false;
    let uniqueParticipantCount: number | undefined;
    if (participantIdCol) {
      const ids = rows.map((r) => r[participantIdCol.name]);
      const uniqueIds = new Set(ids);
      uniqueParticipantCount = uniqueIds.size;
      isRepeatedMeasures = uniqueIds.size < rows.length;
    }

    // Detect survey data
    const ordinalCols = columns.filter((c) => c.inferredType === 'ordinal');
    const isSurveyData = ordinalCols.length >= 3;
    let surveyScaleDetected: string | undefined;
    if (isSurveyData && ordinalCols[0]?.numericStats) {
      const { min, max } = ordinalCols[0].numericStats;
      if (min >= 1 && max <= 5) surveyScaleDetected = 'Likert 5-point';
      else if (min >= 1 && max <= 7) surveyScaleDetected = 'Likert 7-point';
      else if (min >= 1 && max <= 10) surveyScaleDetected = 'Likert 10-point';
    }

    // Match known questionnaires
    const knownQuestionnaires = DataProfiler.matchKnownQuestionnaires(columns);

    return {
      hasParticipantId: !!participantIdCol,
      participantIdColumn: participantIdCol?.name,
      uniqueParticipantCount,
      isRepeatedMeasures,
      repeatedMeasuresIndicator: isRepeatedMeasures ? participantIdCol?.name : undefined,
      hasConditionColumn: conditionCols.length > 0,
      conditionColumns: conditionCols.map((c) => c.name),
      conditionLevels: Object.fromEntries(
        conditionCols.map((c) => [c.name, c.categoricalStats?.uniqueValues || []]),
      ),
      hasTimestamps: timestampCols.length > 0,
      timestampColumns: timestampCols.map((c) => c.name),
      isSurveyData,
      surveyScaleDetected,
      knownQuestionnaires,
    };
  }

  private static matchKnownQuestionnaires(columns: ColumnProfile[]): KnownQuestionnaireMatch[] {
    const matches: KnownQuestionnaireMatch[] = [];
    const columnNames = columns.map((c) => c.name);

    for (const sig of KNOWN_QUESTIONNAIRES) {
      const matchedColumns: string[] = [];
      for (const pattern of sig.columnPatterns) {
        for (const colName of columnNames) {
          if (pattern.test(colName) && !matchedColumns.includes(colName)) {
            matchedColumns.push(colName);
          }
        }
      }

      if (matchedColumns.length > 0) {
        const confidence = Math.min(1, matchedColumns.length / sig.expectedItemCount);
        if (confidence >= 0.3) {
          matches.push({
            name: sig.name,
            confidence,
            matchedColumns,
            expectedColumns: sig.expectedItemCount,
            scoringMethod: sig.scoringMethod,
          });
        }
      }
    }

    return matches;
  }

  // --- Quality assessment ---

  private static assessQuality(columns: ColumnProfile[], rows: Record<string, string>[]): DataProfile['quality'] {
    let totalMissing = 0;
    const columnsWithMissing: string[] = [];

    for (const col of columns) {
      totalMissing += col.missingCount;
      if (col.missingCount > 0) {
        columnsWithMissing.push(col.name);
      }
    }

    // Check for outliers (> 3 SD from mean)
    const outlierColumns: string[] = [];
    for (const col of columns) {
      if (col.numericStats && col.numericStats.std > 0) {
        const { mean, std } = col.numericStats;
        const values = rows.map((r) => Number(r[col.name])).filter((n) => !isNaN(n));
        const hasOutliers = values.some((v) => Math.abs(v - mean) > 3 * std);
        if (hasOutliers) outlierColumns.push(col.name);
      }
    }

    // Check for duplicate rows
    const rowStrings = rows.map((r) => JSON.stringify(r));
    const uniqueRows = new Set(rowStrings);
    const duplicateRowCount = rows.length - uniqueRows.size;

    const totalCells = rows.length * columns.length;

    return {
      missingValueCount: totalMissing,
      missingValuePercentage: totalCells > 0 ? (totalMissing / totalCells) * 100 : 0,
      columnsWithMissing,
      duplicateRowCount,
      outlierColumns,
    };
  }
}
