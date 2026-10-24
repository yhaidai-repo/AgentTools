// A source that has imported PBIs, with its latest import; quiet = nothing for over a day, so it may be broken.
export interface ImportSourceActivity {
  source: string;
  lastImportAt: Date;
  isQuiet: boolean;
}
