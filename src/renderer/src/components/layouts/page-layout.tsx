import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type PageLayoutProps = ComponentProps<'div'> & {
  width?: 'default' | 'wide' | 'full'
  padding?: 'default' | 'compact' | 'none'
}

export function PageLayout({
  width = 'default',
  padding = 'default',
  className,
  ...props
}: PageLayoutProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        { default: 'max-w-4xl', wide: 'max-w-7xl', full: '' }[width],
        {
          default: 'px-ui-sm sm:px-ui-md lg:px-ui-lg',
          compact: 'px-ui-sm',
          none: '',
        }[padding],
        className,
      )}
      {...props}
    />
  )
}
