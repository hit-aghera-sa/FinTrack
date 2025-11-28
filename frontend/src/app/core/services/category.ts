import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  private api = 'http://localhost:5001/api/category';

  constructor(private http: HttpClient) {}

  // Create new category
  createCategory(data: any): Observable<any> {
    return this.http.post(this.api, data, {
      withCredentials: true
    });
  }

  // Get only logged-in user's categories
  getMyCategories(): Observable<any> {
    return this.http.get(this.api, {
      withCredentials: true
    });
  }

  // Admin: get all categories
  getAllCategories(): Observable<any> {
    return this.http.get(this.api + '/all', {
      withCredentials: true
    });
  }

  // Update category
  updateCategory(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.api}/${id}`, data, {
      withCredentials: true
    });
  }

  // Deactivate category
  deleteCategory(id: string): Observable<any> {
  return this.http.patch(`${this.api}/${id}`, { active: false }, {
    withCredentials: true
  });
}

}
