import type { PlaywrightMcpTool } from "./models/PlaywrightMcpTool";

// The tools of @playwright/mcp 0.0.83 with --caps devtools,vision, as its tools/list answers (generated 2026-10-20; regenerate when
// DevHub/playwright-mcp pins another version). The MCP isn't running when a run starts, so the schemas live here.
export const PLAYWRIGHT_MCP_VERSION = "0.0.83";

export const PLAYWRIGHT_MCP_TOOLS: PlaywrightMcpTool[] = [
  {
    "name": "browser_close",
    "description": "Close the page",
    "inputSchema": {
      "properties": {},
      "required": []
    },
    "readOnly": false
  },
  {
    "name": "browser_resize",
    "description": "Resize the browser window",
    "inputSchema": {
      "properties": {
        "width": {
          "type": "number",
          "description": "Width of the browser window"
        },
        "height": {
          "type": "number",
          "description": "Height of the browser window"
        }
      },
      "required": [
        "width",
        "height"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_console_messages",
    "description": "Returns all console messages",
    "inputSchema": {
      "properties": {
        "level": {
          "default": "info",
          "description": "Level of the console messages to return. Each level includes the messages of more severe levels. Defaults to \"info\".",
          "type": "string",
          "enum": [
            "error",
            "warning",
            "info",
            "debug"
          ]
        },
        "all": {
          "description": "Return all console messages since the beginning of the session, not just since the last navigation. Defaults to false.",
          "type": "boolean"
        },
        "filename": {
          "description": "File name to save the console messages to. Relative file names are resolved against the workspace root. If not provided, messages are returned as text.",
          "type": "string"
        }
      },
      "required": [
        "level"
      ]
    },
    "readOnly": true
  },
  {
    "name": "browser_resume",
    "description": "Resume script execution after it was paused. When called with step set to true, execution will pause again before the next action.",
    "inputSchema": {
      "properties": {
        "step": {
          "description": "When true, execution will pause again before the next action, allowing step-by-step debugging.",
          "type": "boolean"
        },
        "location": {
          "description": "Pause execution at a specific <file>:<line>, e.g. \"example.spec.ts:42\".",
          "type": "string"
        }
      },
      "required": []
    },
    "readOnly": false
  },
  {
    "name": "browser_highlight",
    "description": "Show a persistent highlight overlay around the element on the page.",
    "inputSchema": {
      "properties": {
        "element": {
          "description": "Human-readable element description used to obtain permission to interact with the element",
          "type": "string"
        },
        "target": {
          "type": "string",
          "description": "Exact target element reference from the page snapshot, or a unique element selector"
        },
        "style": {
          "description": "Additional inline CSS applied to the highlight overlay, e.g. \"outline: 2px dashed red\".",
          "type": "string"
        }
      },
      "required": [
        "target"
      ]
    },
    "readOnly": true
  },
  {
    "name": "browser_hide_highlight",
    "description": "Remove a highlight overlay previously added for the element.",
    "inputSchema": {
      "properties": {
        "element": {
          "description": "Human-readable element description used when adding the highlight; must match the value passed to browser_highlight.",
          "type": "string"
        },
        "target": {
          "description": "Exact target element reference from the page snapshot, or a unique element selector",
          "type": "string"
        }
      },
      "required": []
    },
    "readOnly": true
  },
  {
    "name": "browser_annotate",
    "description": "Open the Playwright Dashboard in annotation mode for the current page and wait for the user to draw annotations. Returns the annotated screenshot, ARIA snapshot, and the list of annotations.",
    "inputSchema": {
      "properties": {},
      "required": []
    },
    "readOnly": true
  },
  {
    "name": "browser_handle_dialog",
    "description": "Handle a dialog",
    "inputSchema": {
      "properties": {
        "accept": {
          "type": "boolean",
          "description": "Whether to accept the dialog."
        },
        "promptText": {
          "description": "The text of the prompt in case of a prompt dialog.",
          "type": "string"
        }
      },
      "required": [
        "accept"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_emulate_media",
    "description": "Emulate CSS media features for the page, for example switch between the light and dark color scheme. Omitted parameters are left unchanged; null clears an override.",
    "inputSchema": {
      "properties": {
        "colorScheme": {
          "description": "Emulates the prefers-color-scheme media feature",
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "light",
                "dark"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "reducedMotion": {
          "description": "Emulates the prefers-reduced-motion media feature",
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "reduce",
                "no-preference"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "forcedColors": {
          "description": "Emulates the forced-colors media feature",
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "active",
                "none"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "contrast": {
          "description": "Emulates the prefers-contrast media feature",
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "more",
                "no-preference"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "media": {
          "description": "Changes the CSS media type of the page",
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "screen",
                "print"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": []
    },
    "readOnly": false
  },
  {
    "name": "browser_evaluate",
    "description": "Evaluate JavaScript expression on page or element",
    "inputSchema": {
      "properties": {
        "element": {
          "description": "Human-readable element description used to obtain permission to interact with the element",
          "type": "string"
        },
        "target": {
          "description": "Exact target element reference from the page snapshot, or a unique element selector",
          "type": "string"
        },
        "function": {
          "type": "string",
          "description": "() => { /* code */ } or (element) => { /* code */ } when element is provided"
        },
        "filename": {
          "description": "File name to save the result to. Relative file names are resolved against the workspace root. If not provided, result is returned as text.",
          "type": "string"
        }
      },
      "required": [
        "function"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_file_upload",
    "description": "Upload one or multiple files",
    "inputSchema": {
      "properties": {
        "paths": {
          "description": "The absolute paths to the files to upload. Can be single file or multiple files. If omitted, file chooser is cancelled.",
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": []
    },
    "readOnly": false
  },
  {
    "name": "browser_drop",
    "description": "Drop files or MIME-typed data onto an element, as if dragged from outside the page. At least one of \"paths\" or \"data\" must be provided.",
    "inputSchema": {
      "properties": {
        "element": {
          "description": "Human-readable element description used to obtain permission to interact with the element",
          "type": "string"
        },
        "target": {
          "type": "string",
          "description": "Exact target element reference from the page snapshot, or a unique element selector"
        },
        "paths": {
          "description": "Absolute paths to files to drop onto the element.",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "data": {
          "description": "Data to drop, as a map of MIME type to string value (e.g. {\"text/plain\": \"hello\", \"text/uri-list\": \"https://example.com\"}).",
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "string"
          }
        }
      },
      "required": [
        "target"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_find",
    "description": "Search the accessibility snapshot of the current page for text or a regular expression. Returns matching snapshot nodes with a few lines of surrounding context (like search snippets), each shown under its path from the root of the tree, which is cheaper than capturing the whole snapshot when you only need to locate an element and its ref.",
    "inputSchema": {
      "properties": {
        "text": {
          "description": "Plain text to search for in the page snapshot (case-insensitive substring match). Provide either text or regex, not both.",
          "type": "string"
        },
        "regex": {
          "description": "Regular expression to search for in the page snapshot. Matching is case-sensitive by default; wrap the pattern in slashes to add flags, e.g. \"/error/i\" for case-insensitive. Provide either text or regex, not both.",
          "type": "string"
        },
        "filename": {
          "description": "Save results to a file instead of returning them in the response. Relative file names are resolved against the workspace root.",
          "type": "string"
        }
      },
      "required": []
    },
    "readOnly": true
  },
  {
    "name": "browser_fill_form",
    "description": "Fill multiple form fields",
    "inputSchema": {
      "properties": {
        "fields": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "element": {
                "description": "Human-readable element description used to obtain permission to interact with the element",
                "type": "string"
              },
              "target": {
                "type": "string",
                "description": "Exact target element reference from the page snapshot, or a unique element selector"
              },
              "name": {
                "type": "string",
                "description": "Human-readable field name"
              },
              "type": {
                "type": "string",
                "enum": [
                  "textbox",
                  "checkbox",
                  "radio",
                  "combobox",
                  "slider"
                ],
                "description": "Type of the field"
              },
              "value": {
                "type": "string",
                "description": "Value to fill in the field. If the field is a checkbox, the value should be `true` or `false`. If the field is a combobox, the value should be the text of the option."
              }
            },
            "required": [
              "target",
              "name",
              "type",
              "value"
            ],
            "additionalProperties": false
          },
          "description": "Fields to fill in"
        }
      },
      "required": [
        "fields"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_press_key",
    "description": "Press a key on the keyboard",
    "inputSchema": {
      "properties": {
        "key": {
          "type": "string",
          "description": "Name of the key to press or a character to generate, such as `ArrowLeft` or `a`"
        }
      },
      "required": [
        "key"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_type",
    "description": "Type text into editable element",
    "inputSchema": {
      "properties": {
        "element": {
          "description": "Human-readable element description used to obtain permission to interact with the element",
          "type": "string"
        },
        "target": {
          "type": "string",
          "description": "Exact target element reference from the page snapshot, or a unique element selector"
        },
        "text": {
          "type": "string",
          "description": "Text to type into the element"
        },
        "submit": {
          "description": "Whether to submit entered text (press Enter after)",
          "type": "boolean"
        },
        "slowly": {
          "description": "Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.",
          "type": "boolean"
        }
      },
      "required": [
        "target",
        "text"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_mouse_move_xy",
    "description": "Move mouse to a given position",
    "inputSchema": {
      "properties": {
        "x": {
          "type": "number",
          "description": "X coordinate"
        },
        "y": {
          "type": "number",
          "description": "Y coordinate"
        }
      },
      "required": [
        "x",
        "y"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_mouse_click_xy",
    "description": "Click mouse button at a given position",
    "inputSchema": {
      "properties": {
        "x": {
          "type": "number",
          "description": "X coordinate"
        },
        "y": {
          "type": "number",
          "description": "Y coordinate"
        },
        "button": {
          "description": "Button to click, defaults to left",
          "type": "string",
          "enum": [
            "left",
            "right",
            "middle"
          ]
        },
        "clickCount": {
          "description": "Number of clicks, defaults to 1",
          "type": "number"
        },
        "delay": {
          "description": "Time to wait between mouse down and mouse up in milliseconds, defaults to 0",
          "type": "number"
        }
      },
      "required": [
        "x",
        "y"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_mouse_drag_xy",
    "description": "Drag left mouse button to a given position",
    "inputSchema": {
      "properties": {
        "startX": {
          "type": "number",
          "description": "Start X coordinate"
        },
        "startY": {
          "type": "number",
          "description": "Start Y coordinate"
        },
        "endX": {
          "type": "number",
          "description": "End X coordinate"
        },
        "endY": {
          "type": "number",
          "description": "End Y coordinate"
        }
      },
      "required": [
        "startX",
        "startY",
        "endX",
        "endY"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_mouse_down",
    "description": "Press mouse down",
    "inputSchema": {
      "properties": {
        "button": {
          "description": "Button to press, defaults to left",
          "type": "string",
          "enum": [
            "left",
            "right",
            "middle"
          ]
        }
      },
      "required": []
    },
    "readOnly": false
  },
  {
    "name": "browser_mouse_up",
    "description": "Press mouse up",
    "inputSchema": {
      "properties": {
        "button": {
          "description": "Button to press, defaults to left",
          "type": "string",
          "enum": [
            "left",
            "right",
            "middle"
          ]
        }
      },
      "required": []
    },
    "readOnly": false
  },
  {
    "name": "browser_mouse_wheel",
    "description": "Scroll mouse wheel",
    "inputSchema": {
      "properties": {
        "deltaX": {
          "default": 0,
          "description": "X delta",
          "type": "number"
        },
        "deltaY": {
          "default": 0,
          "description": "Y delta",
          "type": "number"
        }
      },
      "required": [
        "deltaX",
        "deltaY"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_navigate",
    "description": "Navigate to a URL",
    "inputSchema": {
      "properties": {
        "url": {
          "type": "string",
          "description": "The URL to navigate to"
        }
      },
      "required": [
        "url"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_navigate_back",
    "description": "Go back to the previous page in the history",
    "inputSchema": {
      "properties": {},
      "required": []
    },
    "readOnly": false
  },
  {
    "name": "browser_network_requests",
    "description": "Returns a numbered list of network requests since loading the page. Use browser_network_request with the number to get full details.",
    "inputSchema": {
      "properties": {
        "static": {
          "default": false,
          "description": "Whether to include successful static resources like images, fonts, scripts, etc. Defaults to false.",
          "type": "boolean"
        },
        "filter": {
          "description": "Only return requests whose URL matches this regexp (e.g. \"/api/.*user\").",
          "type": "string"
        },
        "filename": {
          "description": "File name to save the network requests to. Relative file names are resolved against the workspace root. If not provided, requests are returned as text.",
          "type": "string"
        }
      },
      "required": [
        "static"
      ]
    },
    "readOnly": true
  },
  {
    "name": "browser_network_request",
    "description": "Returns full details (headers and body) of a single network request, or a single part if `part` is set. Use the number from browser_network_requests.",
    "inputSchema": {
      "properties": {
        "index": {
          "type": "integer",
          "minimum": 1,
          "maximum": 9007199254740991,
          "description": "1-based index of the request, as printed by browser_network_requests."
        },
        "part": {
          "description": "Return only this part of the request. Omit to return full details.",
          "type": "string",
          "enum": [
            "request-headers",
            "request-body",
            "response-headers",
            "response-body"
          ]
        },
        "filename": {
          "description": "File name to save the result to. Relative file names are resolved against the workspace root. If not provided, output is returned as text.",
          "type": "string"
        }
      },
      "required": [
        "index"
      ]
    },
    "readOnly": true
  },
  {
    "name": "browser_start_recording",
    "description": "Start recording actions that the user performs in the browser as Playwright code. Use it when the user wants to demonstrate a flow manually. Call browser_stop_recording when the user says they are done to retrieve the recorded actions.",
    "inputSchema": {
      "properties": {},
      "required": []
    },
    "readOnly": true
  },
  {
    "name": "browser_stop_recording",
    "description": "Stop the recording started with browser_start_recording and return the recorded actions as Playwright code.",
    "inputSchema": {
      "properties": {},
      "required": []
    },
    "readOnly": true
  },
  {
    "name": "browser_run_code_unsafe",
    "description": "Run a Playwright code snippet. Unsafe: executes arbitrary JavaScript in the Playwright server process and is RCE-equivalent.",
    "inputSchema": {
      "properties": {
        "code": {
          "description": "A JavaScript function containing Playwright code to execute. It will be invoked with a single argument, page, which you can use for any page interaction. For example: `async (page) => { await page.getByRole('button', { name: 'Submit' }).click(); return await page.title(); }`",
          "type": "string"
        },
        "filename": {
          "description": "Load code from the specified file. Relative file names are resolved against the workspace root. If both code and filename are provided, code will be ignored.",
          "type": "string"
        }
      },
      "required": []
    },
    "readOnly": false
  },
  {
    "name": "browser_take_screenshot",
    "description": "Take a screenshot of the current page. You can't perform actions based on the screenshot, use browser_snapshot for actions.",
    "inputSchema": {
      "properties": {
        "element": {
          "description": "Human-readable element description used to obtain permission to interact with the element",
          "type": "string"
        },
        "target": {
          "description": "Exact target element reference from the page snapshot, or a unique element selector",
          "type": "string"
        },
        "type": {
          "description": "Image format for the screenshot. If unset, inferred from the filename extension, otherwise png.",
          "type": "string",
          "enum": [
            "png",
            "jpeg",
            "webp"
          ]
        },
        "filename": {
          "description": "File name to save the screenshot to. Relative file names are resolved against the workspace root. If not specified, the screenshot is saved into the output directory as `page-{timestamp}.{png|jpeg|webp}`.",
          "type": "string"
        },
        "fullPage": {
          "description": "When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.",
          "type": "boolean"
        },
        "scale": {
          "default": "css",
          "description": "Image resolution scale. \"css\" produces a screenshot sized in CSS pixels (smaller, consistent across devices). \"device\" produces a high-resolution screenshot using device pixels (larger, accounts for the device pixel ratio). Default is css.",
          "type": "string",
          "enum": [
            "css",
            "device"
          ]
        }
      },
      "required": [
        "scale"
      ]
    },
    "readOnly": true
  },
  {
    "name": "browser_snapshot",
    "description": "Capture accessibility snapshot of the current page, this is better than screenshot",
    "inputSchema": {
      "properties": {
        "target": {
          "description": "Exact target element reference from the page snapshot, or a unique element selector",
          "type": "string"
        },
        "filename": {
          "description": "Save snapshot to a file instead of returning it in the response. Relative file names are resolved against the workspace root.",
          "type": "string"
        },
        "depth": {
          "description": "Limit the depth of the snapshot tree",
          "type": "number"
        },
        "boxes": {
          "description": "Include each element's bounding box as [box=x,y,width,height] in the snapshot. Coordinates are viewport-relative, in CSS pixels (Element.getBoundingClientRect)",
          "type": "boolean"
        }
      },
      "required": []
    },
    "readOnly": true
  },
  {
    "name": "browser_click",
    "description": "Perform click on a web page",
    "inputSchema": {
      "properties": {
        "element": {
          "description": "Human-readable element description used to obtain permission to interact with the element",
          "type": "string"
        },
        "target": {
          "type": "string",
          "description": "Exact target element reference from the page snapshot, or a unique element selector"
        },
        "doubleClick": {
          "description": "Whether to perform a double click instead of a single click",
          "type": "boolean"
        },
        "button": {
          "description": "Button to click, defaults to left",
          "type": "string",
          "enum": [
            "left",
            "right",
            "middle"
          ]
        },
        "modifiers": {
          "description": "Modifier keys to press",
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "Alt",
              "Control",
              "ControlOrMeta",
              "Meta",
              "Shift"
            ]
          }
        }
      },
      "required": [
        "target"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_drag",
    "description": "Perform drag and drop between two elements",
    "inputSchema": {
      "properties": {
        "startElement": {
          "description": "Human-readable source element description used to obtain the permission to interact with the element",
          "type": "string"
        },
        "startTarget": {
          "type": "string",
          "description": "Exact target element reference from the page snapshot, or a unique element selector"
        },
        "endElement": {
          "description": "Human-readable target element description used to obtain the permission to interact with the element",
          "type": "string"
        },
        "endTarget": {
          "type": "string",
          "description": "Exact target element reference from the page snapshot, or a unique element selector"
        }
      },
      "required": [
        "startTarget",
        "endTarget"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_hover",
    "description": "Hover over element on page",
    "inputSchema": {
      "properties": {
        "element": {
          "description": "Human-readable element description used to obtain permission to interact with the element",
          "type": "string"
        },
        "target": {
          "type": "string",
          "description": "Exact target element reference from the page snapshot, or a unique element selector"
        }
      },
      "required": [
        "target"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_select_option",
    "description": "Select an option in a dropdown",
    "inputSchema": {
      "properties": {
        "element": {
          "description": "Human-readable element description used to obtain permission to interact with the element",
          "type": "string"
        },
        "target": {
          "type": "string",
          "description": "Exact target element reference from the page snapshot, or a unique element selector"
        },
        "values": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Array of values to select in the dropdown. This can be a single value or multiple values."
        }
      },
      "required": [
        "target",
        "values"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_tabs",
    "description": "List, create, close, or select a browser tab.",
    "inputSchema": {
      "properties": {
        "action": {
          "type": "string",
          "enum": [
            "list",
            "new",
            "close",
            "select"
          ],
          "description": "Operation to perform"
        },
        "index": {
          "description": "Tab index, used for close/select. If omitted for close, current tab is closed.",
          "type": "number"
        },
        "url": {
          "description": "URL to navigate to in the new tab, used for new.",
          "type": "string"
        }
      },
      "required": [
        "action"
      ]
    },
    "readOnly": false
  },
  {
    "name": "browser_start_tracing",
    "description": "Start trace recording",
    "inputSchema": {
      "properties": {},
      "required": []
    },
    "readOnly": true
  },
  {
    "name": "browser_stop_tracing",
    "description": "Stop trace recording",
    "inputSchema": {
      "properties": {},
      "required": []
    },
    "readOnly": true
  },
  {
    "name": "browser_start_video",
    "description": "Start video recording",
    "inputSchema": {
      "properties": {
        "filename": {
          "description": "File name to save the video to. Relative file names are resolved against the workspace root. If not specified, the video is saved into the output directory as `video-{timestamp}.webm`.",
          "type": "string"
        },
        "size": {
          "description": "Video size",
          "type": "object",
          "properties": {
            "width": {
              "type": "number",
              "description": "Video width"
            },
            "height": {
              "type": "number",
              "description": "Video height"
            }
          },
          "required": [
            "width",
            "height"
          ],
          "additionalProperties": false
        },
        "fps": {
          "description": "Video frame rate in frames per second, defaults to 25",
          "type": "number"
        },
        "cursor": {
          "description": "Render an animated mouse cursor that travels to each action point. Paces actions by 800ms so that the cursor has time to travel.",
          "type": "boolean"
        }
      },
      "required": []
    },
    "readOnly": true
  },
  {
    "name": "browser_stop_video",
    "description": "Stop video recording",
    "inputSchema": {
      "properties": {},
      "required": []
    },
    "readOnly": true
  },
  {
    "name": "browser_video_chapter",
    "description": "Add a chapter marker to the video recording. Shows a full-screen chapter card with blurred backdrop.",
    "inputSchema": {
      "properties": {
        "title": {
          "type": "string",
          "description": "Chapter title"
        },
        "description": {
          "description": "Chapter description",
          "type": "string"
        },
        "duration": {
          "description": "Duration in milliseconds to show the chapter card",
          "type": "number"
        }
      },
      "required": [
        "title"
      ]
    },
    "readOnly": true
  },
  {
    "name": "browser_video_show_actions",
    "description": "Annotate subsequent actions performed on the page with a callout that names the action and, when styled, marks the action point and highlights the target element. Useful while video recording or screencasting.",
    "inputSchema": {
      "properties": {
        "duration": {
          "description": "How long each action annotation stays on screen, in milliseconds. Defaults to 500.",
          "type": "number"
        },
        "position": {
          "description": "Where to place the action title relative to the page. Defaults to top-right.",
          "type": "string",
          "enum": [
            "top-left",
            "top",
            "top-right",
            "bottom-left",
            "bottom",
            "bottom-right"
          ]
        },
        "cursor": {
          "description": "Cursor decoration for pointer actions. \"pointer\" (default) animates a mouse pointer from the previous action point to the next one; \"none\" disables the cursor decoration.",
          "type": "string",
          "enum": [
            "none",
            "pointer"
          ]
        },
        "style": {
          "description": "Styles of the action decorations.",
          "type": "object",
          "properties": {
            "point": {
              "description": "CSS declarations for the zero-sized marker centered on the action point, e.g. \"width: 20px; height: 20px; border-radius: 50%; background: red\". Not shown when omitted.",
              "type": "string"
            },
            "highlight": {
              "description": "CSS declarations for the box that covers the target element, e.g. \"outline: 2px solid #333\". Not shown when omitted.",
              "type": "string"
            },
            "title": {
              "description": "CSS declarations for the action title, e.g. \"font-size: 16px\".",
              "type": "string"
            }
          },
          "additionalProperties": false
        }
      },
      "required": []
    },
    "readOnly": true
  },
  {
    "name": "browser_video_hide_actions",
    "description": "Stop annotating actions performed on the page.",
    "inputSchema": {
      "properties": {},
      "required": []
    },
    "readOnly": true
  },
  {
    "name": "browser_wait_for",
    "description": "Wait for text to appear or disappear or a specified time to pass",
    "inputSchema": {
      "properties": {
        "time": {
          "description": "The time to wait in seconds, at most 30",
          "type": "number"
        },
        "text": {
          "description": "The text to wait for",
          "type": "string"
        },
        "textGone": {
          "description": "The text to wait for to disappear",
          "type": "string"
        }
      },
      "required": []
    },
    "readOnly": true
  }
];
