import { FileText } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Seo } from '../../components/ui/Seo'
import { StudentInterestForm } from './StudentInterestForm'

/**
 * Placeholder application page. PRD 02 (Admissions) replaces this single file
 * with the real application form — the route in App.tsx stays the same.
 */
export function ApplyPage() {
  return (
    <>
      <Seo
        title="Apply"
        description="Applications for Cohort 1 of the SVG AI Institute open soon. Leave your email and be first to know."
        path="/apply"
      />
      <div className="mx-auto max-w-2xl px-4 py-12">
        <PageHeader title="Applications" />
        <Card className="mt-8">
          <EmptyState icon={FileText} message="Applications for Cohort 1 open soon." />
          <div className="border-t border-line pt-6">
            <p className="mb-3 text-base font-medium text-ink">
              Want to be first in line? Leave your email:
            </p>
            <StudentInterestForm />
          </div>
        </Card>
      </div>
    </>
  )
}
