import type { Page } from 'playwright'
import type { AccessibilityResult, AuditIssue } from '../types.js'

const IMPACT_TO_SEVERITY = {
  critical: 'critical' as const,
  serious: 'high' as const,
  moderate: 'medium' as const,
  minor: 'low' as const,
}

export async function auditAccessibility(page: Page): Promise<AccessibilityResult> {
  try {
    // Dynamic import for @axe-core/playwright (handles CJS/ESM)
    const { default: AxeBuilder } = await import('@axe-core/playwright')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    return {
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact as 'critical' | 'serious' | 'moderate' | 'minor',
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.slice(0, 5).map((n) => ({
          html: n.html.slice(0, 200),
          target: n.target.map(String),
          failureSummary: n.failureSummary?.slice(0, 300) ?? '',
        })),
      })),
      passes: results.passes.length,
      incomplete: results.incomplete.length,
    }
  } catch (err) {
    console.error('[axe] Error running accessibility audit:', err)
    return { violations: [], passes: 0, incomplete: 0 }
  }
}

export function accessibilityToIssues(
  result: AccessibilityResult,
  auditId: string,
  pageId: string,
  url: string,
  generateId: () => string
): Omit<AuditIssue, 'id'>[] {
  return result.violations.map((v) => ({
    auditId,
    pageId,
    category: 'accessibility' as const,
    severity: IMPACT_TO_SEVERITY[v.impact ?? 'minor'],
    title: v.help,
    description: v.description,
    evidence: JSON.stringify({
      ruleId: v.id,
      affectedNodes: v.nodes.length,
      sample: v.nodes[0]?.html,
      helpUrl: v.helpUrl,
    }),
    recommendation: `Fix ${v.nodes.length} instance(s). See: ${v.helpUrl}`,
    url,
  }))
}

export function scoreAccessibility(result: AccessibilityResult): number {
  const criticalPenalty = result.violations.filter((v) => v.impact === 'critical').length * 15
  const seriousPenalty = result.violations.filter((v) => v.impact === 'serious').length * 10
  const moderatePenalty = result.violations.filter((v) => v.impact === 'moderate').length * 5
  const minorPenalty = result.violations.filter((v) => v.impact === 'minor').length * 2
  return Math.max(0, 100 - criticalPenalty - seriousPenalty - moderatePenalty - minorPenalty)
}
