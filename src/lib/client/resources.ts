import raw from "@/data/generated/resources.json";
import type { Resource } from "@/lib/roadmap/types";
import { withLinkFixes } from "@/lib/resources";

/** The source library (unchanged) with links added for the two book resources that had none. */
export const RESOURCES = withLinkFixes(raw as unknown as Record<string, Resource>);
