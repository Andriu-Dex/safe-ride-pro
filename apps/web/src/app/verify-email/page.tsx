import { VerifyEmailPageContent } from '../../modules/auth/components/verify-email-page-content';

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    code?: string | string[];
    email?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const code = getSingleSearchParam(resolvedSearchParams.code);
  const email = getSingleSearchParam(resolvedSearchParams.email);

  return <VerifyEmailPageContent code={code} email={email} />;
}
