type Props = {
  onDownload: () => void;
  onDismiss: () => void;
};

export const BackupBanner = ({ onDownload, onDismiss }: Props) => (
  <div className="backup-banner" role="status">
    <p className="backup-banner__text">
      You have not backed up in over a week. Download a JSON backup to keep
      your todos safe.
    </p>
    <div className="backup-banner__actions">
      <button type="button" className="toolbar__button" onClick={onDownload}>
        Download backup
      </button>
      <button
        type="button"
        className="toolbar__button toolbar__button--ghost"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  </div>
);
