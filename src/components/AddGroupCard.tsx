type Props = {
  onAddGroup: () => void;
};

export const AddGroupCard = ({ onAddGroup }: Props) => (
  <button
    type="button"
    className="add-group-card"
    onClick={onAddGroup}
    aria-label="Add group"
  >
    <span className="add-group-card__plus">+</span>
  </button>
);
