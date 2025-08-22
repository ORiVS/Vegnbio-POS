// src/components/shared/FullScreenLoader.jsx
export default function FullScreenLoader(){
    return (
        <div className="h-[100vh] w-full grid place-items-center">
            <div className="animate-pulse text-lg opacity-80">Chargement…</div>
        </div>
    );
}
