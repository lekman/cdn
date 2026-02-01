/**
 * Azure Function entry point for the Metadata Extraction function.
 * Triggered by Service Bus queue messages from the upload pipeline.
 *
 * This is a *.system.ts file — excluded from coverage.
 * Contains ONLY wiring logic: message parsing, dependency instantiation, handler call.
 * Zero business logic.
 *
 * Azure Function registration (app.serviceBusQueue) and real SDK client instantiation
 * will be wired when @azure/functions and Azure SDK packages are installed (PRD 2).
 */
import type { ExtractionDeps } from "./handler";
import { extractMetadata } from "./handler";

/**
 * Parses a Service Bus message body and invokes the extraction handler.
 * Called by the Azure Functions runtime with real Cosmos and Blob clients.
 */
export async function handleServiceBusMessage(
  messageBody: unknown,
  deps: ExtractionDeps
): Promise<void> {
  const parsed = typeof messageBody === "string" ? JSON.parse(messageBody) : messageBody;
  const hash =
    typeof (parsed as Record<string, unknown>)?.hash === "string"
      ? ((parsed as Record<string, unknown>).hash as string)
      : "";
  await extractMetadata({ hash }, deps);
}
