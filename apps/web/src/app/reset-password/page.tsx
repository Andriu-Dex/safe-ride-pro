import { ResetPasswordPageContent } from '../../modules/auth/components/reset-password-page-content';

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    code?: string | string[];
    email?: string | string[];
    sent?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const code = getSingleSearchParam(resolvedSearchParams.code);
  const email = getSingleSearchParam(resolvedSearchParams.email);
  const sent = getSingleSearchParam(resolvedSearchParams.sent) === '1';

  return <ResetPasswordPageContent code={code} email={email} sent={sent} />;
}
