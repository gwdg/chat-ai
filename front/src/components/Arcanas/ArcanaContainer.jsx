const ArcanaContainer = ({ localState, setLocalState }) => {
  const handleIDChange = (e) => {
    setLocalState((prev) => ({
      ...prev,
      arcana: {
        ...prev.arcana,
        id: e.target.value,
      },
    }));
  };

  const handleKeyChange = (e) => {
    setLocalState((prev) => ({
      ...prev,
      arcana: {
        ...prev.arcana,
        key: e.target.value,
      },
    }));
  };

  return (
    <div className="w-full flex gap-1">
      <input
        type="text"
        value={localState.arcana.id}
        onChange={handleIDChange}
        placeholder="id"
        className="dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark w-full max-h-[47px]"
      />

      <input
        type="text"
        value={localState.arcana.key}
        onChange={handleKeyChange}
        placeholder="key"
        className="dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border outline-none rounded-2xl shadow-lg dark:shadow-dark w-full max-h-[47px] dark:border-border_dark"
      />
    </div>
  );
};

export default ArcanaContainer;
