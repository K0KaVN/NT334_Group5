// bypass_stealth_linux.js
console.log("[!] Dang chay Bypass Stealth Script cho Linux...");

// Lấy tham chiếu đến libc
var libc = Process.getModuleByName("libc.so.6");

// --- 1. Bypass ptrace (PTRACE_TRACEME) ---
try {
    var ptracePtr = libc.findExportByName("ptrace");
    if (ptracePtr) {
        Interceptor.attach(ptracePtr, {
            onEnter: function (args) {
                // Ép kiểu an toàn sang số nguyên
                this.request = parseInt(args[0].toString(), 10);
            },
            onLeave: function (retval) {
                if (this.request === 0) {
                    retval.replace(0);
                }
            }
        });
        console.log("[+] Da cai dat Hook vo hieu hoa ptrace");
    }
} catch (e) {
    console.log("[-] Loi hook ptrace: " + e);
}

// --- 2. Bypass đọc /proc/self/status và /proc/self/maps ---
function hook_open(funcName, pathArgIndex) {
    try {
        var funcPtr = libc.findExportByName(funcName);
        if (funcPtr) {
            Interceptor.attach(funcPtr, {
                onEnter: function (args) {
                    try {
                        var path = args[pathArgIndex].readUtf8String();
                        if (path && (path.indexOf("/proc/self/status") !== -1 || path.indexOf("/proc/self/maps") !== -1)) {
                            var fakePath = Memory.allocUtf8String("/dev/null"); 
                            args[pathArgIndex] = fakePath; 
                        }
                    } catch (err) {
                        // Bỏ qua lỗi đọc chuỗi
                    }
                }
            });
            console.log("[+] Da cai dat Hook bao ve /proc/self/status & maps (" + funcName + ")");
        }
    } catch (e) {
        console.log("[-] Khong the hook " + funcName + ": " + e);
    }
}

// Các hàm open, fopen lấy đường dẫn ở tham số đầu (index 0)
hook_open("open", 0);
hook_open("open64", 0);
hook_open("fopen", 0);
hook_open("fopen64", 0);

// openat lấy đường dẫn ở tham số thứ 2 (index 1)
hook_open("openat", 1);
hook_open("openat64", 1);

console.log("[*] Stealth mode Linux ACTIVATED. Da co the an tam trich xuat TLS.");
