import { LoginPageContent } from '../../modules/auth/components/login-page-content';

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
    email?: string | string[];
    verified?: string | string[];
    reset?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const nextPath = getSingleSearchParam(resolvedSearchParams.next) ?? '/dashboard';
  const initialEmail = getSingleSearchParam(resolvedSearchParams.email);
  const showVerifiedMessage = getSingleSearchParam(resolvedSearchParams.verified) === '1';
  const showResetMessage = getSingleSearchParam(resolvedSearchParams.reset) === '1';

  return (
    <LoginPageContent
      initialEmail={initialEmail}
      nextPath={nextPath}
      showVerifiedMessage={showVerifiedMessage}
      showResetMessage={showResetMessage}
    />
  );
}
