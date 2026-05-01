// Composants UI partagés — @org/ui-components
// Construits avec shadcn/ui + Radix UI + Tailwind CSS

// Utilitaires
export { cn } from './lib/utils';

// Composants de base
export { Button, buttonVariants } from './lib/button';
export type { ButtonProps } from './lib/button';

export { Badge, badgeVariants, getDraftStatusVariant } from './lib/badge';
export type { BadgeProps } from './lib/badge';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './lib/card';

export { Input } from './lib/input';
export { Textarea } from './lib/textarea';
export { Label } from './lib/label';

// Composants de navigation
export { Tabs, TabsList, TabsTrigger, TabsContent } from './lib/tabs';
