import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private api = 'http://localhost:5001/api/transaction';

  constructor(private http: HttpClient) {}

  createTransaction(data: any): Observable<any> {
    return this.http.post(this.api, data, { withCredentials: true });
  }

  getMyTransactions(): Observable<any> {
    return this.http.get(this.api, { withCredentials: true });
  }

  updateTransaction(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.api}/${id}`, data, {
      withCredentials: true,
    });
  }

  deleteTransaction(id: string): Observable<any> {
    return this.http.delete(`${this.api}/${id}`, { withCredentials: true });
  }

  uploadAttachments(transactionId: string, formData: FormData) {
    return this.http.post<{ status: string; attachments: string[] }>(
      `http://localhost:5001/api/attachment/transaction/${transactionId}`,
      formData,
      { withCredentials: true },
    );
  }

  deleteAttachment(transactionId: string, index: number) {
    return this.http.delete<{ status: string; attachments: string[] }>(
      `http://localhost:5001/api/attachment/transaction/${transactionId}/${index}`,
      { withCredentials: true },
    );
  }

  updateAttachment(transactionId: string, index: number, formData: FormData) {
    return this.http.patch<{ status: string; attachments: string[] }>(
      `http://localhost:5001/api/attachment/transaction/${transactionId}/${index}`,
      formData,
      { withCredentials: true },
    );
  }
}
