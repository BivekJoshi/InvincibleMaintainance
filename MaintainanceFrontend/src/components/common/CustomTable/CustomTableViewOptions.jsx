import {
  Columns3, Download, Eye, EyeOff, Maximize2, Minimize2, RotateCcw, Rows2, Rows3, Rows4,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { DENSITIES } from './useCustomTableLayout';

const DENSITY = {
  compact: { label: 'Compact', icon: Rows4 },
  normal: { label: 'Normal', icon: Rows3 },
  comfortable: { label: 'Comfortable', icon: Rows2 },
};

const keepOpen = (e) => e.preventDefault();

/**
 * The table's view controls at the end of the toolbar: the Columns menu (show / hide,
 * show all, reset layout), row density, full screen and CSV export. Each is on only
 * when its flag is.
 *
 * @param {object} props
 * @param {import('@tanstack/react-table').Table<object>} props.table
 * @param {{ hiding: boolean, density: boolean, fullScreen: boolean, exportable: boolean }} props.enabled
 * @param {string} props.density
 * @param {(density: string) => void} props.onDensityChange
 * @param {boolean} props.fullScreen
 * @param {(on: boolean) => void} props.onFullScreenChange
 * @param {(selectedOnly: boolean) => void} props.onExport
 * @param {number} props.selectedCount
 * @param {boolean} props.layoutIsDefault
 * @param {() => void} props.onResetLayout
 */
export function CustomTableViewOptions({
  table, enabled, density, onDensityChange, fullScreen, onFullScreenChange, onExport, selectedCount,
  layoutIsDefault, onResetLayout,
}) {
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());
  const nextDensity = DENSITIES[(DENSITIES.indexOf(density) + 1) % DENSITIES.length];
  const DensityIcon = DENSITY[density].icon;

  return (
    <>
      {enabled.exportable ? (
        selectedCount ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm"><Download aria-hidden /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onExport(false)}>This page (CSV)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onExport(true)}>{selectedCount} selected (CSV)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => onExport(false)}>
            <Download aria-hidden /> Export
          </Button>
        )
      ) : null}
      {enabled.hiding && hideable.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm"><Columns3 aria-hidden /> Columns</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Show columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hideable.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(v) => column.toggleVisibility(v === true)}
                onSelect={keepOpen}
              >
                {column.columnDef.meta?.label || column.id}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { keepOpen(e); table.toggleAllColumnsVisible(true); }}>
              <Eye aria-hidden /> Show all
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { keepOpen(e); table.toggleAllColumnsVisible(false); }}>
              <EyeOff aria-hidden /> Hide all
            </DropdownMenuItem>
            {!layoutIsDefault ? (
              <DropdownMenuItem onSelect={onResetLayout}>
                <RotateCcw aria-hidden /> Reset layout
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {enabled.density ? (
        <Button
          type="button" variant="outline" size="icon" className="h-8 w-8"
          onClick={() => onDensityChange(nextDensity)}
          aria-label={`Row density: ${DENSITY[density].label}. Switch to ${DENSITY[nextDensity].label}`}
          title={`Density: ${DENSITY[density].label}`}
        >
          <DensityIcon aria-hidden />
        </Button>
      ) : null}
      {enabled.fullScreen ? (
        <Button
          type="button" variant="outline" size="icon" className="h-8 w-8"
          onClick={() => onFullScreenChange(!fullScreen)}
          aria-pressed={fullScreen}
          aria-label={fullScreen ? 'Exit full screen' : 'Full screen'}
          title={fullScreen ? 'Exit full screen (Esc)' : 'Full screen'}
        >
          {fullScreen ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
        </Button>
      ) : null}
    </>
  );
}
