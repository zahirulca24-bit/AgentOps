import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface NavigationContextType {
  pathname: string;
  navigate: (href: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({
  children,
  initialPath = '/',
}: {
  children: React.ReactNode;
  initialPath?: string;
}) {
  const [pathname, setPathname] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || initialPath;
    }
    return initialPath;
  });

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname || '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = useCallback((href: string) => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== href) {
        window.history.pushState(null, '', href);
        setPathname(href);
      }
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }, []);

  return (
    <NavigationContext.Provider value={{ pathname, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function usePathname(): string {
  const context = useContext(NavigationContext);
  if (!context) {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  }
  return context.pathname;
}

export function useRouter() {
  const context = useContext(NavigationContext);
  const navigate = context?.navigate ?? ((href: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', href);
    }
  });

  return {
    push: navigate,
    pathname: context?.pathname ?? '/',
  };
}

export interface LinkProps extends React.HTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  className?: string;
  target?: string;
  rel?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  'aria-label'?: string;
}

export function Link({ href, children, className, onClick, ...props }: LinkProps) {
  const { navigate, pathname } = useContext(NavigationContext) || {
    navigate: (url: string) => {
      if (typeof window !== 'undefined') {
        window.location.href = url;
      }
    },
    pathname: '/',
  };

  const isCurrent = href === '/' ? pathname === '/' : pathname.startsWith(href);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e);
    }

    // Allow standard browser shortcuts (Cmd/Ctrl click to open in new tab)
    if (
      !e.defaultPrevented &&
      e.button === 0 &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.shiftKey &&
      !props.target
    ) {
      e.preventDefault();
      navigate(href);
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-current={isCurrent ? 'page' : undefined}
      className={className}
      {...props}
    >
      {children}
    </a>
  );
}
