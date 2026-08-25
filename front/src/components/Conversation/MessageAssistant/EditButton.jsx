import { Edit } from "lucide-react";

export default function EditButton({ setEditMode }) {
    // Function to handle editing message
    const handleEdit = () => {
        setEditMode(true);
    };

    return (
        <button onClick={handleEdit} title="Edit message" className=" h-[18px] w-[18px] cursor-pointer">
            {" "}
            <Edit
                className="opacity-25 group-hover:opacity-100 transition-opacity duration-300 h-[18px] w-[18px] cursor-pointer text-[#009EE0]"
                alt="edit_icon"
            />
        </button>
    );
}
