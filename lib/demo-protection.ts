export type DemoProtectionUser = {
  isDemoAccount?: boolean;
  university?: {
    kind?: string;
    isReadOnlyDemo?: boolean;
  } | null;
};

export function isReadOnlyDemoUser(user: DemoProtectionUser): boolean {
  return (
    user.isDemoAccount === true &&
    user.university?.kind === "DEMO" &&
    user.university.isReadOnlyDemo === true
  );
}
