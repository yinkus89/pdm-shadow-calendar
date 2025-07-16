import { useEffect, useState } from 'react';
import { Textarea }        from "@/components/ui/textarea";
import { Button }          from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableHead, TableRow,
  TableHeader, TableBody, TableCell
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from "@/components/ui/select";


const API = 'http://localhost:4000';

export default function App() {
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  /* load sub‑task list once */
  useEffect(() => {
    fetch(`${API}/tasks`)
      .then(r => r.json())
      .then(setTasks)
      .catch(console.error);
  }, []);

  /* parse text */
  const parse = async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: raw, employee: 'Me' })
      }).then(r => r.json());
      setRows(res);
    } catch {
      setMsg('Parse failed');
    }
    setLoading(false);
  };

  /* submit */
  const submit = async () => {
    setLoading(true);
    setMsg('');
    try {
      await fetch(`${API}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: raw, employee: 'Me', rows })
      });
      setMsg('✓ Submitted!');
    } catch {
      setMsg('Submit failed');
    }
    setLoading(false);
  };

  /* update ERP sub‑task inline */
  const updateRow = (idx, val) =>
    setRows(curr => curr.map((r, i) => (i === idx ? { ...r, erp_subtask: val } : r)));

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <Textarea
            rows={8}
            placeholder="Paste shadow‑calendar text here"
            value={raw}
            onChange={e => setRaw(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={parse} disabled={loading}>Parse</Button>
            <Button variant="secondary" onClick={submit} disabled={!rows.length || loading}>
              Submit
            </Button>
          </div>
          {msg && <p className="text-sm text-green-600">{msg}</p>}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Date</TableHeader>
              <TableHeader>Time</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>ERP Sub‑task</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.start_time} – {r.end_time}</TableCell>
                <TableCell>{r.task_description}</TableCell>
                <TableCell>
                  <Select value={r.erp_subtask} onValueChange={val => updateRow(i, val)}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Pick sub‑task" />
                    </SelectTrigger>
                    <SelectContent>
                      {tasks.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
