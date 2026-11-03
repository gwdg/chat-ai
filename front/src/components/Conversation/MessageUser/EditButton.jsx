import { Edit } from "lucide-react";

export default function EditButton({ setEditMode }) {
    // Function to handle editing message
    const handleEdit = () => {
        setEditMode(true);
    };

    return (
        <button onClick={handleEdit}>
            {" "}
            <Edit
                className="h-[18px] w-[18px] cursor-pointer text-accent"
                alt="edit_icon"
            />
        </button>
    );
}
