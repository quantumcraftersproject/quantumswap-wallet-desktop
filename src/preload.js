const { contextBridge, ipcRenderer, shell, fs, readline, remote,app } = require('electron');

contextBridge.exposeInMainWorld('StorageApi', {
    SetItem: function (key, value) {
        window.localStorage.setItem(key, JSON.stringify(value));
        result = window.localStorage.getItem(key);
    },
    GetItem: function (key) {
        result = window.localStorage.getItem(key);
        return result;
    }
});


contextBridge.exposeInMainWorld('ClipboardApi', {
    send: (channel, data) => ipcRenderer.invoke(channel, data),
    handle: (channel, callable, event, data) => ipcRenderer.on(channel, callable(event, data))
})

contextBridge.exposeInMainWorld('ShellApi', {
    send: (channel, data) => ipcRenderer.invoke(channel, data),
    handle: (channel, callable, event, data) => ipcRenderer.on(channel, callable(event, data))
})

contextBridge.exposeInMainWorld('FileApi', {
    send: (channel, data) => ipcRenderer.invoke(channel, data),
    handle: (channel, callable, event, data) => ipcRenderer.on(channel, callable(event, data))
})

contextBridge.exposeInMainWorld('LocalStorageApi', {
    send: (channel, data) => ipcRenderer.invoke(channel, data),
    handle: (channel, callable, event, data) => ipcRenderer.on(channel, callable(event, data))
})

contextBridge.exposeInMainWorld('CryptoApi', {
    send: (channel, data) => ipcRenderer.invoke(channel, data),
    handle: (channel, callable, event, data) => ipcRenderer.on(channel, callable(event, data))
})

contextBridge.exposeInMainWorld('FormatApi', {
    send: (channel, data) => ipcRenderer.invoke(channel, data),
    handle: (channel, callable, event, data) => ipcRenderer.on(channel, callable(event, data))
})


contextBridge.exposeInMainWorld('AppApi', {
    send: (channel, data) => ipcRenderer.invoke(channel, data),
    handle: (channel, callable, event, data) => ipcRenderer.on(channel, callable(event, data))
})

contextBridge.exposeInMainWorld('SwapQuoteApi', {
    send: (channel, data) => ipcRenderer.invoke(channel, data)
})