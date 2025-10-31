import React from 'react';

interface IconProps {
  className?: string; 
  "aria-hidden"?: boolean;
  style?: React.CSSProperties; // Allow passing style for font-variation-settings if needed
}

const defaultBaseClass = "material-symbols-outlined align-middle leading-none";

export const PlusIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>add</span>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>chevron_right</span>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>expand_more</span>
);

export const HomeIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>home</span>
);

export const SaveIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>save</span>
);

export const CancelIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>cancel</span>
);

export const TrashIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>delete</span>
);

export const EditIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>edit</span>
);

export const CheckIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>check</span>
);

export const CogIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>settings</span>
);

export const EyeIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>visibility</span>
);

export const EyeSlashIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>visibility_off</span>
);

export const DocumentTextIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>article</span>
);

// FIX: Add missing LinkIcon component.
export const LinkIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>link</span>
);

export const MoreVertIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>more_vert</span>
);

export const FilterListIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>filter_list</span>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>chevron_left</span>
);

export const TodayIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>today</span>
);

export const AddTaskIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>add_task</span>
);

export const PlaylistAddIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>playlist_add</span>
);

export const BarChartIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>bar_chart</span>
);

export const CloudUploadIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>cloud_upload</span>
);

export const PaletteIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>palette</span>
);

export const SubdirectoryArrowRightIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>subdirectory_arrow_right</span>
);

export const ArrowUpwardIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>arrow_upward</span>
);

export const ArrowDownwardIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>arrow_downward</span>
);

export const TableViewIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>table_view</span>
);

export const ShowChartIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>show_chart</span>
);

export const DragHandleIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>drag_handle</span>
);

export const FileDownloadIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>cloud_download</span>
);

export const PictureAsPdfIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>picture_as_pdf</span>
);

export const ContentCopyIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>content_copy</span>
);

export const AttachFileIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>attach_file</span>
);

export const LocationIcon: React.FC<IconProps> = ({ className, "aria-hidden": ariaHidden = true, style }) => (
  <span className={`${defaultBaseClass} ${className || 'text-base'}`} aria-hidden={ariaHidden} style={style}>location_on</span>
);