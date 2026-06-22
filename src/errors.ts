/**
 * Typed error hierarchy for outlion.
 *
 * Every error the library throws on purpose extends {@link OutlineError}, so
 * callers can `instanceof OutlineError` to tell an expected, recoverable
 * condition apart from an unexpected crash.
 */
export class OutlineError extends Error {
  constructor(message: string) {
    super(message);
    // Preserve the concrete subclass name and prototype chain across the
    // TS->ES down-level transpile (Error subclassing footgun).
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when no generator is registered for a file extension. */
export class UnsupportedExtensionError extends OutlineError {
  constructor(public readonly extension: string) {
    super(`No generator found for file extension: ${extension}`);
  }
}

/** Thrown when no formatter is registered for an output format. */
export class UnsupportedFormatError extends OutlineError {
  constructor(public readonly format: string, available: string[] = []) {
    super(
      `No formatter found for format: ${format}` +
        (available.length ? ` (available: ${available.join(', ')})` : ''),
    );
  }
}

/**
 * Thrown when a generator cannot parse its input. Carries best-effort
 * location context. Generators should prefer degrading to a partial outline
 * over throwing this; it exists for the cases where no output is possible.
 */
export class OutlineParseError extends OutlineError {
  constructor(
    message: string,
    public readonly fileName?: string,
    public readonly line?: number,
    public readonly column?: number,
  ) {
    super(message);
  }
}
