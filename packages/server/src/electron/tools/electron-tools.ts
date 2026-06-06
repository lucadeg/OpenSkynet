/**
 * Electron Tool Provider
 *
 * Provides specialized tools for the Electron agent including:
 * - Browser automation tools
 * - Document processing tools (PDF, PPT, etc.)
 * - File operation tools
 * - Multi-modal content tools
 */

import type { ToolBus } from "../../agent/tools/bus";
import { getOpenbrowserAdapter } from "../../agent/tools/browser-tools";

export interface ElectronToolsOpts {
  enableBrowserTools?: boolean;
  enableDocumentTools?: boolean;
  enableFileTools?: boolean;
}

/**
 * Register all Electron-specific tools to the ToolBus
 */
export function registerElectronTools(
  toolBus: ToolBus,
  opts: ElectronToolsOpts = {}
): void {
  const {
    enableBrowserTools = true,
    enableDocumentTools = true,
    enableFileTools = true,
  } = opts;

  // Register browser automation tools
  if (enableBrowserTools) {
    registerBrowserTools(toolBus);
  }

  // Register document processing tools
  if (enableDocumentTools) {
    registerDocumentTools(toolBus);
  }

  // Register file operation tools
  if (enableFileTools) {
    registerFileTools(toolBus);
  }

  // Register multi-modal tools
  registerMultiModalTools(toolBus);
}

/**
 * Register browser automation tools from Openbrowser
 */
function registerBrowserTools(toolBus: ToolBus): void {
  const adapter = getOpenbrowserAdapter();
  if (!adapter) {
    console.warn("Openbrowser adapter not available, browser tools disabled");
    return;
  }

  const definitions = adapter.getToolDefinitions();

  for (const def of definitions) {
    toolBus.register(def.name, {
      description: def.description,
      parameters: def.inputSchema,
      execute: async (args) => {
        const result = await adapter.executeTool(def.name, args);
        if (result.success) {
          return { success: true, output: result.output };
        } else {
          return { success: false, error: result.error };
        }
      },
    });
  }
}

/**
 * Register document processing tools for PDF, PPT, etc.
 */
function registerDocumentTools(toolBus: ToolBus): void {
  // PDF processing tool
  toolBus.register("pdf_extract", {
    description: `Extract text and metadata from PDF files.
Supports extracting:
- Plain text content
- Metadata (author, title, creation date)
- Page count and structure
- Embedded images (if supported)

Use this tool when you need to read, analyze, or process PDF documents.`,
    parameters: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to the PDF file"
        },
        extract_metadata: {
          type: "boolean",
          description: "Extract PDF metadata (default: true)",
          default: true
        },
        extract_images: {
          type: "boolean",
          description: "Extract embedded images (default: false)",
          default: false
        }
      },
      required: ["file_path"]
    },
    execute: async (args) => {
      try {
        // Import PDF processing library
        const { extractFromPDF } = await import("./pdf-processor");
        const result = await extractFromPDF(
          args.file_path as string,
          args.extract_metadata as boolean,
          args.extract_images as boolean
        );
        return { success: true, output: JSON.stringify(result) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  });

  // PDF modification tool
  toolBus.register("pdf_modify", {
    description: `Modify PDF files by adding text, images, or annotations.
Supports:
- Adding text overlays
- Inserting images
- Adding annotations and comments
- Merging multiple PDFs
- Splitting PDFs

Use this tool when you need to edit or combine PDF documents.`,
    parameters: {
      type: "object",
      properties: {
        source_path: {
          type: "string",
          description: "Path to the source PDF file"
        },
        output_path: {
          type: "string",
          description: "Path where the modified PDF will be saved"
        },
        operation: {
          type: "string",
          enum: ["add_text", "add_image", "merge", "split", "annotate"],
          description: "Type of modification to perform"
        },
        options: {
          type: "object",
          description: "Operation-specific options"
        }
      },
      required: ["source_path", "output_path", "operation"]
    },
    execute: async (args) => {
      try {
        const { modifyPDF } = await import("./pdf-processor");
        const result = await modifyPDF(
          args.source_path as string,
          args.output_path as string,
          args.operation as string,
          args.options as Record<string, unknown>
        );
        return { success: true, output: JSON.stringify(result) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  });

  // PowerPoint processing tool
  toolBus.register("ppt_process", {
    description: `Process and manipulate PowerPoint/PPTX files.
Supports:
- Reading slide content
- Extracting text and images
- Modifying slide content
- Adding/removing slides
- Changing templates

Use this tool when you need to work with PowerPoint presentations.`,
    parameters: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to the PowerPoint file"
        },
        operation: {
          type: "string",
          enum: ["read", "extract", "modify", "create"],
          description: "Operation to perform"
        },
        options: {
          type: "object",
          description: "Operation-specific options"
        }
      },
      required: ["file_path", "operation"]
    },
    execute: async (args) => {
      try {
        const { processPPT } = await import("./ppt-processor");
        const result = await processPPT(
          args.file_path as string,
          args.operation as string,
          args.options as Record<string, unknown>
        );
        return { success: true, output: JSON.stringify(result) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  });

  // Document conversion tool
  toolBus.register("document_convert", {
    description: `Convert between document formats.
Supported conversions:
- PDF to Word/PPT
- Word/PPT to PDF
- Markdown to PDF/Word
- HTML to PDF/Word

Use this tool to convert documents between different formats.`,
    parameters: {
      type: "object",
      properties: {
        source_path: {
          type: "string",
          description: "Path to the source file"
        },
        output_path: {
          type: "string",
          description: "Path where the converted file will be saved"
        },
        target_format: {
          type: "string",
          enum: ["pdf", "docx", "pptx", "md", "html", "txt"],
          description: "Target format"
        }
      },
      required: ["source_path", "output_path", "target_format"]
    },
    execute: async (args) => {
      try {
        const { convertDocument } = await import("./document-converter");
        const result = await convertDocument(
          args.source_path as string,
          args.output_path as string,
          args.target_format as string
        );
        return { success: true, output: JSON.stringify(result) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  });
}

/**
 * Register file operation tools
 */
function registerFileTools(toolBus: ToolBus): void {
  // These are already implemented in the main server
  // We can reference them or provide enhanced versions

  toolBus.register("file_search", {
    description: `Search for files by name or content.
Supports:
- Wildcard patterns (*.txt, document_*.pdf)
- Content search (grep-like)
- Recursive directory search
- File type filtering

Use this tool to locate files matching specific criteria.`,
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "File name pattern or search query"
        },
        directory: {
          type: "string",
          description: "Directory to search in (default: current directory)"
        },
        search_content: {
          type: "boolean",
          description: "Search file contents instead of names (default: false)"
        },
        file_types: {
          type: "array",
          items: { type: "string" },
          description: "File extensions to include (e.g., ['pdf', 'txt'])"
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return (default: 50)"
        }
      },
      required: ["pattern"]
    },
    execute: async (args) => {
      try {
        const { searchFiles } = await import("./file-search");
        const result = await searchFiles({
          pattern: args.pattern as string,
          directory: args.directory as string | undefined,
          searchContent: args.search_content as boolean,
          fileTypes: args.file_types as string[] | undefined,
          maxResults: args.max_results as number | undefined,
        });
        return { success: true, output: JSON.stringify(result) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  });

  toolBus.register("file_batch_read", {
    description: `Read multiple files at once for batch processing.
Useful when you need to:
- Read all files in a directory
- Process multiple documents
- Compare file contents

Returns an array of file contents with metadata.`,
    parameters: {
      type: "object",
      properties: {
        file_paths: {
          type: "array",
          items: { type: "string" },
          description: "List of file paths to read"
        },
        include_metadata: {
          type: "boolean",
          description: "Include file metadata (default: true)"
        }
      },
      required: ["file_paths"]
    },
    execute: async (args) => {
      try {
        const { batchReadFiles } = await import("./file-operations");
        const result = await batchReadFiles(
          args.file_paths as string[],
          args.include_metadata as boolean
        );
        return { success: true, output: JSON.stringify(result) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  });
}

/**
 * Register multi-modal content tools
 */
function registerMultiModalTools(toolBus: ToolBus): void {
  toolBus.register("image_analyze", {
    description: `Analyze images using vision capabilities.
Can:
- Extract text from images (OCR)
- Identify objects and scenes
- Read charts and graphs
- Analyze screenshots

Use this tool to process and understand image content.`,
    parameters: {
      type: "object",
      properties: {
        image_path: {
          type: "string",
          description: "Path to the image file"
        },
        extract_text: {
          type: "boolean",
          description: "Perform OCR to extract text (default: true)"
        },
        analyze_content: {
          type: "boolean",
          description: "Analyze image content (default: true)"
        }
      },
      required: ["image_path"]
    },
    execute: async (args) => {
      try {
        const { analyzeImage } = await import("./image-processor");
        const result = await analyzeImage(
          args.image_path as string,
          args.extract_text as boolean,
          args.analyze_content as boolean
        );
        return { success: true, output: JSON.stringify(result) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  });

  toolBus.register("screenshot_analyze", {
    description: `Take and analyze screenshots of web pages or applications.
Combines browser screenshot with visual analysis to:
- Extract text from UI elements
- Identify buttons and interactive elements
- Analyze page layouts
- Verify visual changes

Use this tool to visually inspect and analyze interfaces.`,
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "URL (for web pages) or application identifier"
        },
        region: {
          type: "object",
          description: "Specific region to capture (x, y, width, height)"
        },
        analysis_options: {
          type: "object",
          description: "Options for analysis (extract_text, detect_elements, etc.)"
        }
      },
      required: ["target"]
    },
    execute: async (args) => {
      try {
        // First take screenshot using browser tools
        const adapter = getOpenbrowserAdapter();
        if (!adapter) {
          return { success: false, error: "Browser adapter not available" };
        }

        const screenshotResult = await adapter.executeTool("browser_screenshot", {
          instance_id: args.target
        });

        if (!screenshotResult.success) {
          return { success: false, error: screenshotResult.error };
        }

        // Then analyze the screenshot
        const { analyzeImage } = await import("./image-processor");
        const result = await analyzeImage(
          screenshotResult.output as string,
          true, // extract_text
          true  // analyze_content
        );

        return { success: true, output: JSON.stringify(result) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  });
}
