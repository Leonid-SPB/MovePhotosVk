@set CWD_CYG=%~dp0
@set CWD_CYG=%CWD_CYG:\=/%
@set CYG_BIN=C:\Apps\cygwin\bin
@%CYG_BIN%\mintty.exe -i /Cygwin-Terminal.ico /bin/sh -lc 'cd "$(cygpath "$CWD_CYG")"; exec bash'
