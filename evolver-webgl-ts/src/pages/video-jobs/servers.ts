export interface ServersInfo {
    activeServer?: string;
}

export function saveServersInfo(serversInfo: ServersInfo) {
    localStorage.setItem("local-servers", JSON.stringify(serversInfo));
}

export function loadServersInfo(): ServersInfo {
    const data = localStorage.getItem("local-servers");
    if (data) {
        return JSON.parse(data) as ServersInfo;
    }
    const serversInfo = {
        activeServer: "http://localhost:8081"
    };
    saveServersInfo(serversInfo);
    return serversInfo;
}
