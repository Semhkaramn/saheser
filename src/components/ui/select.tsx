"use client";

import * as React from "react";
import { cn, normalizeForSearch } from "@/lib/utils";

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  selectItems: Map<string, React.ReactNode>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const SelectContext = React.createContext<SelectContextType | undefined>(undefined);

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

// Helper function to extract SelectItems from children
const extractSelectItems = (children: React.ReactNode): Map<string, React.ReactNode> => {
  const items = new Map<string, React.ReactNode>();

  const traverse = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (React.isValidElement(child)) {
        // Check if this element has a 'value' prop (likely a SelectItem)
        if (child.props && typeof child.props === 'object' && 'value' in child.props && typeof child.props.value === 'string') {
          const value = child.props.value;
          const label: React.ReactNode = 'children' in child.props ? child.props.children as React.ReactNode : value;
          if (value) {
            items.set(value, label);
          }
        }
        // Recursively traverse children
        if (child.props && typeof child.props === 'object' && 'children' in child.props && child.props.children) {
          traverse(child.props.children as React.ReactNode);
        }
      }
    });
  };

  traverse(children);
  return items;
};

// 🔍 Arama kutusuna yazılan metne göre SelectItem'ları filtreler. Yapıyı
// (Fragment/wrapper öğeler dahil) korur, sadece eşleşmeyen SelectItem'ları
// listeden çıkarır. Türkçe İ/I duyarsız arama için normalizeForSearch kullanır.
const filterChildrenBySearch = (children: React.ReactNode, query: string): React.ReactNode => {
  if (!query.trim()) return children;
  const normalizedQuery = normalizeForSearch(query);

  const getTextContent = (node: React.ReactNode): string => {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getTextContent).join(' ');
    if (React.isValidElement(node) && node.props && typeof node.props === 'object' && 'children' in node.props) {
      return getTextContent(node.props.children as React.ReactNode);
    }
    return '';
  };

  const filter = (node: React.ReactNode): React.ReactNode => {
    return React.Children.map(node, (child) => {
      if (!React.isValidElement(child)) return child;

      const isSelectItem =
        child.props && typeof child.props === 'object' && 'value' in child.props && typeof child.props.value === 'string';

      if (isSelectItem) {
        const text = getTextContent((child.props as { children?: React.ReactNode }).children);
        return normalizeForSearch(text).includes(normalizedQuery) ? child : null;
      }

      if (child.props && typeof child.props === 'object' && 'children' in child.props && child.props.children) {
        return React.cloneElement(child as React.ReactElement<any>, {
          children: filter(child.props.children as React.ReactNode),
        });
      }

      return child;
    });
  };

  return filter(children);
};

const Select = ({ value, onValueChange, children }: SelectProps) => {
  const [open, setOpen] = React.useState(false);
  const [selectItems, setSelectItems] = React.useState<Map<string, React.ReactNode>>(() =>
    extractSelectItems(children)
  );
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Update items when children change
  React.useEffect(() => {
    setSelectItems(extractSelectItems(children));
  }, [children]);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, selectItems, triggerRef }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
};

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.HTMLAttributes<HTMLButtonElement>>(
  ({ className = "", children, ...props }, forwardedRef) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectTrigger must be used within Select");

    return (
      <button
        ref={(node) => {
          context.triggerRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        }}
        type="button"
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border border-[var(--user-card-border,#232E4A)] bg-[var(--user-background-secondary,#111A2E)] px-3 py-2 text-sm text-[var(--user-text,#F1F5F9)] placeholder:text-[var(--user-text-muted,#64748B)] focus:outline-none focus:ring-2 focus:ring-[var(--user-primary,#3B82F6)] disabled:opacity-50",
          className
        )}
        onClick={() => context.setOpen(!context.open)}
        {...props}
      >
        {children}
        <span className="ml-2">▼</span>
      </button>
    );
  }
);
SelectTrigger.displayName = "SelectTrigger";

const SelectValue = ({ placeholder = "" }: { placeholder?: string }) => {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error("SelectValue must be used within Select");

  const selectedLabel = context.selectItems.get(context.value);

  return <span>{selectedLabel || placeholder}</span>;
};

// 📱 Mobil / tablo içi kırpılma düzeltmesi:
// Önceden dropdown "position: absolute" ile Select'in kendi wrapper'ına göre
// konumlanıyordu. Bu wrapper yatay kaydırılan bir tablonun (overflow-x-auto)
// içindeyse, CSS kuralı gereği overflow-y de otomatik "auto" oluyor ve
// dropdown görünse bile aşağı kaydırılamıyor / kesiliyordu (mobilde
// Sponsorlar > Kullanıcı Verileri'ndeki durum seçiciler gibi).
// Çözüm: dropdown'ı "position: fixed" yapıp tetikleyici butonun ekran
// üzerindeki gerçek konumuna göre yerleştiriyoruz - artık hiçbir scroll
// container'a bağlı değil, her zaman görünür ve tıklanabilir.
const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = "", children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectContent must be used within Select");

    const [coords, setCoords] = React.useState<{ top: number; left: number; width: number; openUpward: boolean } | null>(null);
    const [search, setSearch] = React.useState('');
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    // Her açılışta aramayı sıfırla, arama kutusuna odaklan
    React.useEffect(() => {
      if (context.open) {
        setSearch('');
        // Odağı bir sonraki tick'e bırak - dropdown DOM'a girsin diye
        const t = setTimeout(() => searchInputRef.current?.focus(), 0);
        return () => clearTimeout(t);
      }
    }, [context.open]);

    React.useLayoutEffect(() => {
      if (!context.open || !context.triggerRef.current) {
        setCoords(null);
        return;
      }

      const updatePosition = () => {
        const trigger = context.triggerRef.current;
        if (!trigger) return
        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUpward = spaceBelow < 260 && rect.top > spaceBelow;
        setCoords({
          top: openUpward ? rect.top : rect.bottom,
          left: rect.left,
          width: rect.width,
          openUpward,
        });
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }, [context.open, context]);

    if (!context.open || !coords) return null;

    // ⚠️ ÖNEMLİ: caller'dan gelen `style` prop'unu (örn. background/border
    // vermek için kullanılıyor) burada hesaplanan position/top/left/width
    // değerleriyle BİRLEŞTİRİYORUZ. Önceden {...props} en sona konduğu için
    // caller'ın style'ı bizim fixed positioning'imizi tamamen eziyordu - bu
    // da dropdown'ın yanlış yerde (ya da hiç görünmeyecek şekilde) render
    // olmasına, dolayısıyla "tıklanmıyor" hissi veren bir hataya yol açıyordu.
    const { style: callerStyle, ...restProps } = props;
    // Uzun listelerde (6'dan fazla seçenek - sponsor, kullanıcı, grup vb.)
    // otomatik arama kutusu göster; kısa sabit listelerde (örn. 4-5 durumluk
    // bir seçici) gereksiz yere göstermeyelim.
    const showSearch = context.selectItems.size > 6;
    const visibleChildren = showSearch ? filterChildrenBySearch(children, search) : children;
    const hasResults = React.Children.toArray(visibleChildren).length > 0;

    return (
      <>
        <div className="fixed inset-0 z-40" onClick={() => context.setOpen(false)} />
        <div
          ref={ref}
          style={{
            position: 'fixed',
            top: coords.openUpward ? undefined : coords.top + 4,
            bottom: coords.openUpward ? window.innerHeight - coords.top + 4 : undefined,
            left: coords.left,
            width: Math.max(coords.width, 140),
            ...callerStyle,
          }}
          className={cn(
            "z-50 max-h-72 overflow-y-auto rounded-lg border border-[var(--user-card-border,#232E4A)] bg-[var(--user-background-secondary,#111A2E)] py-1 shadow-lg",
            className
          )}
          {...restProps}
        >
          {showSearch && (
            <div className="sticky top-0 px-1.5 pb-1.5 mb-1 border-b border-[var(--user-card-border,#232E4A)] bg-inherit">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Ara..."
                className="w-full h-8 px-2 text-sm rounded-md bg-black/20 text-[var(--user-text,#F1F5F9)] placeholder:text-[var(--user-text-muted,#64748B)] outline-none border border-transparent focus:border-[var(--user-primary,#3B82F6)]"
              />
            </div>
          )}
          {visibleChildren}
          {showSearch && !hasResults && (
            <p className="px-3 py-2 text-sm text-[var(--user-text-muted,#64748B)]">Sonuç bulunamadı</p>
          )}
        </div>
      </>
    );
  }
);
SelectContent.displayName = "SelectContent";

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className = "", value, children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectItem must be used within Select");

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm text-[var(--user-text,#F1F5F9)] outline-none hover:bg-[var(--user-card,#141D33)] transition-colors",
          context.value === value ? "bg-[var(--user-card,#141D33)]" : "",
          className
        )}
        onClick={() => {
          context.onValueChange(value);
          context.setOpen(false);
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SelectItem.displayName = "SelectItem";

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
