import icon_edit from "../../../assets/icons/edit.svg";

export default function EditButton({ 
    setEditMode
}) {
    // Function to handle editing message
    const handleEdit = () => {
        setEditMode(true);
    };

    return (
        <button
        onClick={handleEdit}
        >
        <img
            src={icon_edit}
            alt="edit_icon"
            className="h-[22px] w-[22px] cursor-pointer"
        />
        </button>
    );
}