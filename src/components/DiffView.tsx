import React from "react";
import { Box, Text } from "ink";
import { homedir } from "node:os";
import { highlightLine } from "../utils/syntaxHighlight.js";

interface DiffViewProps {
  toolName: "FileEdit" | "FileWrite" | "FileRead";
  rawOutput: string;
  isError?: boolean;
  errorMessage?: string;
}

interface ParsedDiff {
  verb: string;
  filePath: string;
  summary: string;
  lines: Array<{ lineNo: string; marker: " " | "-" | "+" | "…"; text: string }>;
}

const HOME = homedir();

function shortenPath(p: string): string {
  if (!p) return "";
  if (p.startsWith(HOME)) return "~" + p.slice(HOME.length);
  return p;
}

function parseDiff(raw: string): ParsedDiff | null {
  const lines = raw.split("\n");
  if (lines.length < 3) return null;
  const headerMatch = lines[0].match(/^(Updated|Created|Overwrote|Wrote)\s+(.+)$/);
  if (!headerMatch) return null;
  const summary = lines[1] || "";
  const sepIdx = lines.indexOf("---");
  if (sepIdx < 0) return null;

  const diffLines: ParsedDiff["lines"] = [];
  for (let i = sepIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const m = l.match(/^(\s*\d+|\s+…|\s{6})\s([ \-+])\s\s(.*)$/);
    if (m) {
      const lineNo = m[1].trimStart() === "…" ? "…" : m[1];
      diffLines.push({
        lineNo,
        marker: m[2] as " " | "-" | "+",
        text: m[3],
      });
    } else {
      diffLines.push({ lineNo: "", marker: " ", text: l });
    }
  }

  return {
    verb: headerMatch[1],
    filePath: headerMatch[2],
    summary,
    lines: diffLines,
  };
}

export function DiffView({ toolName, rawOutput, isError, errorMessage }: DiffViewProps) {
  const parsed = !isError ? parseDiff(rawOutput) : null;

  const verbToBadge = (verb: string) => {
    switch (verb) {
      case "Created":
        return { label: "Create", color: "green" as const };
      case "Overwrote":
        return { label: "Write", color: "yellow" as const };
      case "Updated":
        return { label: "Update", color: "cyan" as const };
      default:
        return { label: "Update", color: "cyan" as const };
    }
  };

  if (isError || !parsed) {
    const filePath = (rawOutput.match(/^[^\n]*\b(\/[^\s:]+|~[^\s:]+)/m) || [])[1] || "";
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="red" bold>● </Text>
          <Text bold>{toolName === "FileWrite" ? "Write" : "Update"}</Text>
          {filePath && <Text>({shortenPath(filePath)})</Text>}
          <Text color="red"> failed</Text>
        </Box>
        {errorMessage && (
          <Box marginLeft={2}>
            <Text color="red" dimColor>{errorMessage.slice(0, 400)}</Text>
          </Box>
        )}
      </Box>
    );
  }

  const badge = verbToBadge(parsed.verb);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={badge.color} bold>● </Text>
        <Text bold>{badge.label}</Text>
        <Text>(</Text>
        <Text color="cyan">{shortenPath(parsed.filePath)}</Text>
        <Text>)</Text>
      </Box>

      <Box marginLeft={2}>
        <Text dimColor>└ </Text>
        <Text dimColor>{parsed.summary}</Text>
      </Box>

      <Box flexDirection="column" marginLeft={2}>
        {parsed.lines.map((row, idx) => {
          const numColor = "gray";
          let markerEl: React.ReactNode = <Text> </Text>;
          let textEl: React.ReactNode;

          if (row.marker === "-") {
            markerEl = <Text color="red" bold>-</Text>;
            textEl = <Text color="red">{row.text}</Text>;
          } else if (row.marker === "+") {
            markerEl = <Text color="green" bold>+</Text>;
            textEl = <Text color="green">{row.text}</Text>;
          } else {
            const highlighted = highlightLine(row.text, parsed.filePath);
            textEl = <Text>{highlighted}</Text>;
          }

          return (
            <Box key={idx}>
              <Text color={numColor}>{row.lineNo.padStart(5, " ")}</Text>
              <Text> </Text>
              {markerEl}
              <Text>  </Text>
              {textEl}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
