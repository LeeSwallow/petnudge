import { restVariant, ROLES, type Part, type Role } from '../../domain/character/parts';

// The part roles the editor offers (#71), in Korean, and the pictures of a
// part a cut or a dropped file can go into: the part at rest, and for eyes
// and mouths the variant blinking or talking needs (감은 눈, 연 입).

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  body: '몸',
  head: '머리',
  eye: '눈',
  mouth: '입',
  foot: '발·다리',
  hand: '손·팔',
  hair: '머리카락',
  ear: '귀',
  tail: '꼬리',
  accessory: '장식'
};
export const ROLE_CHOICES: readonly { value: Role; label: string }[] = ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));

const VARIANT_LABELS: Record<string, string> = { open: '뜬', closed: '감은', smile: '웃는' };
// The variant each role is expected to have besides the one at rest.
const WANTED: Partial<Record<Role, string>> = { eye: 'closed', mouth: 'open' };

export const variantLabel = (part: Pick<Part, 'role'>, variant: string) =>
  part.role === 'mouth' ? (variant === 'open' ? '연 입' : variant === 'closed' ? '닫은 입' : variant) : part.role === 'eye' ? `${VARIANT_LABELS[variant] ?? variant} 눈` : variant;

// Where a picture can go in a part: `''` is the part at rest.
export const picturesFor = (part: Part): { variant: string; label: string }[] => {
  const extra = [...new Set([...(part.role && WANTED[part.role] ? [WANTED[part.role]!] : []), ...Object.keys(part.variants ?? {})])];
  return [
    { variant: '', label: part.label + (extra.length ? ` · ${variantLabel(part, restVariant(part))}` : '') },
    ...extra.map((v) => ({ variant: v, label: `${part.label} · ${variantLabel(part, v)}` }))
  ];
};
