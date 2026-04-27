import { RegisterPageContent } from '../../modules/auth/components/register-page-content';

type RegisterPageProps = {
  searchParams?: Promise<{
    email?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const initialEmail = getSingleSearchParam(resolvedSearchParams.email);

  return <RegisterPageContent initialEmail={initialEmail} />;
}
